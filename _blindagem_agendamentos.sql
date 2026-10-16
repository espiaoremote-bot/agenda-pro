-- =====================================================================
--  BLINDAGEM DOS AGENDAMENTOS  (Agenda Pro)  — rode no SQL do Supabase
--  ------------------------------------------------------------------
--  Problema: a chave pública (anon) fica no bundle do site/APK e a tabela
--  `agendamentos` está com RLS DESLIGADO. Qualquer pessoa lê, altera e
--  exclui agendamentos de QUALQUER profissional, sem login.
--
--  Solução (camadas, sem quebrar o app):
--   1) Sessão por token (o app não usa Supabase Auth; provamos "quem" é o
--      profissional por um token gerado no login).
--   2) RPCs `security definer` que fazem TODA leitura/escrita de
--      agendamentos, com validação de dono no servidor.
--   3) Liga RLS e REMOVE o acesso direto da role `anon`. As RPCs rodam por
--      cima (security definer ignora RLS/grants). A Edge Function de push
--      usa service_role e continua ok.
--
--  Idempotente (pode rodar 2x). Reversível: role o BLOCO DE ROLLBACK no fim.
--  ⚠️ Depois de ligar o RLS, o app passa a usar as RPCs e o Realtime da
--     tabela para de entregar eventos ao anon — a sincronização passa a ser
--     por polling (já existe no app, a cada 20s).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- 0) Garante a coluna de hash usada pelo login seguro.
alter table public.profissionais add column if not exists senha_hash text;

create or replace function public.sync_profissionais_senha_hash()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' or new.senha is distinct from old.senha then
    if new.senha is null or new.senha = '' then
      new.senha_hash := null;
    elsif new.senha like '$2%' then
      new.senha_hash := new.senha;              -- já é hash, só copia
    else
      new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt('bf', 10));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profissionais_senha_hash on public.profissionais;
create trigger trg_sync_profissionais_senha_hash
before insert or update of senha on public.profissionais
for each row execute function public.sync_profissionais_senha_hash();

update public.profissionais
set senha_hash = extensions.crypt(senha, extensions.gen_salt('bf', 10))
where senha is not null and senha <> ''
  and (senha_hash is null or senha_hash not like '$2%');

-- 1) Garante colunas opcionais usadas nas ações.
alter table public.agendamentos add column if not exists dataconcluido date;
alter table public.agendamentos add column if not exists datacancelamento text;

-- 2) TABELA DE SESSÃO (token do profissional logado).
create table if not exists public.sessoes_profissional (
  token           uuid primary key default gen_random_uuid(),
  profissional_id integer not null references public.profissionais(id) on delete cascade,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default now() + interval '30 days'
);
create index if not exists idx_sessoes_expira on public.sessoes_profissional(expira_em);
alter table public.sessoes_profissional enable row level security;
-- Ninguém acessa direto: só via RPCs security definer.

-- token -> id do profissional (ou null se inválido/expirado).
create or replace function public.sessao_profissional_id(p_token uuid)
returns integer language sql stable security definer set search_path = public as $$
  select s.profissional_id
  from public.sessoes_profissional s
  where s.token = p_token and s.expira_em > now()
  limit 1;
$$;
grant execute on function public.sessao_profissional_id(uuid) to anon, authenticated;

-- 3) LOGIN COM SESSÃO: valida a senha por hash e devolve um token.
--    NUNCA devolve senha/hash — só os dados do profissional.
create or replace function public.sessao_abrir(p_nome text, p_senha text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  t uuid;
begin
  select p.* into r
  from public.profissionais p
  where p.nome = p_nome
    and p.senha_hash is not null
    and p.senha_hash = extensions.crypt(p_senha, p.senha_hash)
  order by p.id
  limit 1;

  if not found then
    return null;                               -- nome ou senha incorretos
  end if;

  insert into public.sessoes_profissional(profissional_id)
  values (r.id)
  returning token into t;

  return json_build_object(
    'token', t,
    'profissional', to_jsonb(r) - 'senha' - 'senha_hash'
  );
end;
$$;
grant execute on function public.sessao_abrir(text, text) to anon, authenticated;

create or replace function public.sessao_fechar(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.sessoes_profissional where token = p_token;
$$;
grant execute on function public.sessao_fechar(uuid) to anon, authenticated;

-- 4) RPCs DE AGENDAMENTO -------------------------------------------------

-- 4.1 Listar agendamentos do profissional dono da sessão.
create or replace function public.ag_listar(p_token uuid)
returns setof public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  return query
    select * from public.agendamentos
    where profissional_id = v_pid
    order by id desc;
end;
$$;
grant execute on function public.ag_listar(uuid) to anon, authenticated;

-- 4.2 Disponibilidade para o CLIENTE anônimo: só horários ocupados,
--     sem expor nome/whatsapp de outros clientes.
create or replace function public.ag_disponibilidade_cliente(
  p_profissional_id integer,
  p_data date
)
returns table(horario text, servico text, horario_liberado boolean)
language sql security definer set search_path = public as $$
  select a.horario, a.servico, a.horario_liberado
  from public.agendamentos a
  where a.profissional_id = p_profissional_id
    and a.data = p_data
    and a.status = 'Agendado';
$$;
grant execute on function public.ag_disponibilidade_cliente(integer, date) to anon, authenticated;

-- 4.2b Listagem pública (CLIENTE anônimo): agendamentos do profissional
--      SEM dados pessoais (nome/whatsapp/valor). Serve para o cliente
--      calcular quais horários estão ocupados, sem expor outros clientes.
create or replace function public.ag_listar_publico(p_profissional_id integer)
returns table(
  id integer,
  data text,
  horario text,
  servico text,
  status text,
  horario_liberado boolean
)
language sql security definer set search_path = public as $$
  select a.id, a.data::text, a.horario, a.servico, a.status, a.horario_liberado
  from public.agendamentos a
  where a.profissional_id = p_profissional_id
  order by a.id desc;
$$;
grant execute on function public.ag_listar_publico(integer) to anon, authenticated;

-- 4.3 Cliente cria 1 agendamento (validações no servidor).
create or replace function public.ag_criar_cliente(
  p_profissional_id integer,
  p_nome text,
  p_whatsapp text,
  p_servico text,
  p_valor numeric,
  p_data date,
  p_horario text,
  p_status text
)
returns setof public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_ativo boolean;
begin
  select ativo into v_ativo from public.profissionais where id = p_profissional_id;
  if not found then
    raise exception 'profissional_inexistente' using errcode = 'P0001';
  end if;
  if v_ativo is distinct from true then
    raise exception 'profissional_inativo' using errcode = 'P0001';
  end if;

  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome_obrigatorio' using errcode = '22023';
  end if;
  if p_servico is null or btrim(p_servico) = '' then
    raise exception 'servico_obrigatorio' using errcode = '22023';
  end if;
  if p_horario is null or btrim(p_horario) = '' then
    raise exception 'horario_obrigatorio' using errcode = '22023';
  end if;
  if p_data < current_date then
    raise exception 'data_no_passado' using errcode = '22023';
  end if;
  if p_status not in ('Agendado', 'Pendente') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;

  -- A UNIQUE (profissional_id, data, horario), se existir, gera 23505
  -- quando o horário já está reservado — propagado ao cliente.
  return query
    insert into public.agendamentos
      (nome, whatsapp, servico, valor_servico, data, horario, status, horario_liberado, profissional_id)
    values
      (btrim(p_nome), p_whatsapp, p_servico, coalesce(p_valor, 0), p_data, p_horario, p_status, false, p_profissional_id)
    returning *;
end;
$$;
grant execute on function public.ag_criar_cliente(integer, text, text, text, numeric, date, text, text) to anon, authenticated;

-- 4.4 Profissional cria VÁRIOS agendamentos (recorrência).
--     Força dono = sessão, status Agendado, horario_liberado false.
create or replace function public.ag_criar_profissional(p_token uuid, p_linhas jsonb)
returns setof public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  return query
    insert into public.agendamentos
      (nome, whatsapp, servico, valor_servico, data, horario, status, horario_liberado, profissional_id)
    select
      btrim(l->>'nome'),
      l->>'whatsapp',
      l->>'servico',
      coalesce((l->>'valor_servico')::numeric, 0),
      (l->>'data')::date,
      l->>'horario',
      'Agendado',
      false,
      v_pid
    from jsonb_array_elements(p_linhas) l
    where btrim(coalesce(l->>'nome','')) <> ''
      and btrim(coalesce(l->>'servico','')) <> ''
      and btrim(coalesce(l->>'horario','')) <> ''
      and (l->>'data') is not null
      and (l->>'data')::date >= current_date
    returning *;
end;
$$;
grant execute on function public.ag_criar_profissional(uuid, jsonb) to anon, authenticated;

-- 4.5 Atualiza 1 agendamento do dono da sessão.
--     Whitelist de colunas para não permitir mudar dono/id indevidamente.
create or replace function public.ag_atualizar(p_token uuid, p_id integer, p_campos jsonb)
returns setof public.agendamentos
language plpgsql security definer set search_path = public as $$
declare
  v_pid      integer := public.sessao_profissional_id(p_token);
  v_filtrado jsonb;
  rec        public.agendamentos;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  v_filtrado := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p_campos, '{}'::jsonb)) e(k, v)
    where k in ('status','horario_liberado','datacancelamento','dataconcluido','valor_servico','data','horario')
  );

  if v_filtrado = '{}'::jsonb then
    return query select * from public.agendamentos where id = p_id and profissional_id = v_pid;
    return;
  end if;

  rec := jsonb_populate_record(null::public.agendamentos, v_filtrado);

  return query
    update public.agendamentos a set
      status           = coalesce(rec.status, a.status),
      horario_liberado = coalesce(rec.horario_liberado, a.horario_liberado),
      datacancelamento = coalesce(rec.datacancelamento, a.datacancelamento),
      dataconcluido    = coalesce(rec.dataconcluido, a.dataconcluido),
      valor_servico    = coalesce(rec.valor_servico, a.valor_servico),
      data             = coalesce(rec.data, a.data),
      horario          = coalesce(rec.horario, a.horario)
    where a.id = p_id and a.profissional_id = v_pid
    returning a.*;
end;
$$;
grant execute on function public.ag_atualizar(uuid, integer, jsonb) to anon, authenticated;

-- 4.6 Atualiza VÁRIOS (ex.: cancelar toda a recorrência).
create or replace function public.ag_atualizar_varios(p_token uuid, p_ids integer[], p_campos jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_pid      integer := public.sessao_profissional_id(p_token);
  v_filtrado jsonb;
  rec        public.agendamentos;
  v_n        integer;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  v_filtrado := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p_campos, '{}'::jsonb)) e(k, v)
    where k in ('status','horario_liberado','datacancelamento','dataconcluido','valor_servico','data','horario')
  );
  if v_filtrado = '{}'::jsonb then
    return 0;
  end if;

  rec := jsonb_populate_record(null::public.agendamentos, v_filtrado);

  update public.agendamentos a set
    status           = coalesce(rec.status, a.status),
    horario_liberado = coalesce(rec.horario_liberado, a.horario_liberado),
    datacancelamento = coalesce(rec.datacancelamento, a.datacancelamento),
    dataconcluido    = coalesce(rec.dataconcluido, a.dataconcluido),
    valor_servico    = coalesce(rec.valor_servico, a.valor_servico),
    data             = coalesce(rec.data, a.data),
    horario          = coalesce(rec.horario, a.horario)
  where a.id = any(p_ids) and a.profissional_id = v_pid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.ag_atualizar_varios(uuid, integer[], jsonb) to anon, authenticated;

-- 4.7 Exclui agendamentos (por id) do dono da sessão.
create or replace function public.ag_excluir(p_token uuid, p_ids integer[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
  v_n   integer;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  delete from public.agendamentos
  where id = any(p_ids) and profissional_id = v_pid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.ag_excluir(uuid, integer[]) to anon, authenticated;

-- 4.8 Contagem total (painel do admin).
create or replace function public.ag_contar_admin()
returns bigint language sql security definer set search_path = public as $$
  select count(*) from public.agendamentos;
$$;
grant execute on function public.ag_contar_admin() to anon, authenticated;

-- 5) FECHAR A PORTA: RLS ligado + sem acesso direto da role anon.
--    A partir daqui o app SÓ conversa com `agendamentos` via RPCs.
--    service_role (Edge Functions de push) continua ignorando RLS.
alter table public.agendamentos enable row level security;
revoke all on table public.agendamentos from anon, authenticated;

-- ---------------------------------------------------------------------
--  VERIFICAÇÃO (rode e confira ANTES de publicar o app novo):
--    select * from public.sessao_abrir('NOME', 'SENHA');  -- volta {token, profissional}
--    select relname, relrowsecurity
--      from pg_class where relname in ('agendamentos','sessoes_profissional');
--    -- agendamentos deve estar relrowsecurity = true
-- ---------------------------------------------------------------------

-- =====================================================================
--  BLOCO DE ROLLBACK — descomente para desfazer TUDO e voltar ao estado
--  anterior (o app antigo volta a funcionar):
-- =====================================================================
-- alter table public.agendamentos disable row level security;
-- grant select, insert, update, delete on table public.agendamentos to anon, authenticated;
-- drop function if exists public.ag_contar_admin();
-- drop function if exists public.ag_excluir(uuid, integer[]);
-- drop function if exists public.ag_atualizar_varios(uuid, integer[], jsonb);
-- drop function if exists public.ag_atualizar(uuid, integer, jsonb);
-- drop function if exists public.ag_criar_profissional(uuid, jsonb);
-- drop function if exists public.ag_criar_cliente(integer, text, text, text, numeric, date, text, text);
-- drop function if exists public.ag_disponibilidade_cliente(integer, date);
-- drop function if exists public.ag_listar_publico(integer);
-- drop function if exists public.ag_listar(uuid);
-- drop function if exists public.sessao_fechar(uuid);
-- drop function if exists public.sessao_abrir(text, text);
-- drop function if exists public.sessao_profissional_id(uuid);
-- drop table if exists public.sessoes_profissional;
