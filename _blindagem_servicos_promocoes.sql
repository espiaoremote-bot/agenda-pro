-- =====================================================================
--  BLINDAGEM DE SERVIÇOS E PROMOÇÕES — rode no SQL do Supabase
--  ------------------------------------------------------------------
--  Serviços e promoções NÃO têm senha, então não há vazamento de credencial.
--  O problema é INTEGRIDADE: qualquer um criava/editava/excluía serviços e
--  promoções de QUALQUER profissional pela chave pública.
--
--  Estratégia:
--   * LEITURA (select) continua PÚBLICA — o catálogo é público por natureza
--     (o cliente precisa ver para agendar).
--   * ESCRITA (insert/update/delete) passa por RPCs `security definer` que
--     conferem o dono pelo token de sessão.
--   * RLS ligado: policy de SELECT pública; SEM policy de escrita, então a
--     chave pública (anon) não escreve mais direto. As RPCs ignoram RLS.
--
--  Idempotente. Reversível: role o BLOCO DE ROLLBACK no fim.
--  Depende da sessão criada em _blindagem_agendamentos.sql
--  (tabela sessoes_profissional + função sessao_profissional_id).
-- =====================================================================

-- Garante colunas usadas pelas promoções (evita o fallback do app).
alter table public.promocoes add column if not exists dias_semana integer[] not null default '{}';

-- ---------------------------------------------------------------------
-- SERVIÇOS
-- ---------------------------------------------------------------------

-- Criar serviço (dono = sessão).
create or replace function public.serv_criar(
  p_token   uuid,
  p_nome    text,
  p_valor   numeric,
  p_duracao text
)
returns setof public.servicos
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'nome_obrigatorio' using errcode = '22023';
  end if;

  return query
    insert into public.servicos (nome, valor, duracao, profissional_id, ativo)
    values (btrim(p_nome), p_valor, p_duracao, v_pid, true)
    returning *;
end;
$$;
grant execute on function public.serv_criar(uuid, text, numeric, text) to anon, authenticated;

-- Atualizar serviço do dono. Whitelist: nome, valor, duracao, ativo.
create or replace function public.serv_atualizar(p_token uuid, p_id integer, p_campos jsonb)
returns setof public.servicos
language plpgsql security definer set search_path = public as $$
declare
  v_pid      integer := public.sessao_profissional_id(p_token);
  v_filtrado jsonb;
  rec        public.servicos;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  v_filtrado := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p_campos, '{}'::jsonb)) e(k, v)
    where k in ('nome','valor','duracao','ativo')
  );

  if v_filtrado = '{}'::jsonb then
    return query select * from public.servicos where id = p_id and profissional_id = v_pid;
    return;
  end if;

  rec := jsonb_populate_record(null::public.servicos, v_filtrado);

  return query
    update public.servicos s set
      nome     = coalesce(rec.nome, s.nome),
      valor    = coalesce(rec.valor, s.valor),
      duracao  = coalesce(rec.duracao, s.duracao),
      ativo    = coalesce(rec.ativo, s.ativo)
    where s.id = p_id and s.profissional_id = v_pid
    returning s.*;
end;
$$;
grant execute on function public.serv_atualizar(uuid, integer, jsonb) to anon, authenticated;

-- Excluir serviço do dono.
create or replace function public.serv_excluir(p_token uuid, p_id integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
  v_n   integer;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  delete from public.servicos where id = p_id and profissional_id = v_pid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.serv_excluir(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- PROMOÇÕES
-- ---------------------------------------------------------------------

-- Garante a coluna do seletor de promoções (usada pela RPC promo_seletor).
alter table public.profissionais
  add column if not exists seletor_promocoes_habilitado boolean not null default true;

-- Criar promoção (dono = sessão). Respeita o UNIQUE (profissional_id, servico).
create or replace function public.promo_criar(
  p_token   uuid,
  p_servico text,
  p_valor   numeric,
  p_duracao text
)
returns setof public.promocoes
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  if p_servico is null or btrim(p_servico) = '' then
    raise exception 'servico_obrigatorio' using errcode = '22023';
  end if;

  return query
    insert into public.promocoes
      (profissional_id, servico, valor, duracao, meses, semanas, ativo)
    values
      (v_pid, btrim(p_servico), coalesce(p_valor, 0), coalesce(p_duracao, ''),
       '{}'::integer[], '{}'::jsonb, true)
    returning *;
end;
$$;
grant execute on function public.promo_criar(uuid, text, numeric, text) to anon, authenticated;

-- Atualizar promoção do dono. Whitelist: valor, duracao, meses, semanas,
-- dias_semana, ativo. (servico NÃO é editável — mantém o vínculo com o catálogo.)
create or replace function public.promo_atualizar(p_token uuid, p_id integer, p_campos jsonb)
returns setof public.promocoes
language plpgsql security definer set search_path = public as $$
declare
  v_pid      integer := public.sessao_profissional_id(p_token);
  v_filtrado jsonb;
  rec        public.promocoes;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  v_filtrado := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(coalesce(p_campos, '{}'::jsonb)) e(k, v)
    where k in ('valor','duracao','meses','semanas','dias_semana','ativo')
  );

  if v_filtrado = '{}'::jsonb then
    return query select * from public.promocoes where id = p_id and profissional_id = v_pid;
    return;
  end if;

  rec := jsonb_populate_record(null::public.promocoes, v_filtrado);

  return query
    update public.promocoes p set
      valor       = coalesce(rec.valor, p.valor),
      duracao     = coalesce(rec.duracao, p.duracao),
      meses       = coalesce(rec.meses, p.meses),
      semanas     = coalesce(rec.semanas, p.semanas),
      dias_semana = coalesce(rec.dias_semana, p.dias_semana),
      ativo       = coalesce(rec.ativo, p.ativo)
    where p.id = p_id and p.profissional_id = v_pid
    returning p.*;
end;
$$;
grant execute on function public.promo_atualizar(uuid, integer, jsonb) to anon, authenticated;

-- Atualizar VÁRIAS promoções de uma vez (ex.: copiar meses/semanas/dias
-- para todas). Whitelist restrita aos períodos — valor/duração não mudam.
create or replace function public.promo_atualizar_varios(p_token uuid, p_ids integer[], p_campos jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_pid      integer := public.sessao_profissional_id(p_token);
  v_filtrado jsonb;
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
    where k in ('meses','semanas','dias_semana')
  );

  if v_filtrado = '{}'::jsonb then
    return 0;
  end if;

  with src as (
    select * from jsonb_to_record(v_filtrado)
      as x(meses integer[], semanas jsonb, dias_semana integer[])
  )
  update public.promocoes p set
    meses       = coalesce(src.meses, p.meses),
    semanas     = coalesce(src.semanas, p.semanas),
    dias_semana = coalesce(src.dias_semana, p.dias_semana)
  from src
  where p.id = any(p_ids) and p.profissional_id = v_pid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.promo_atualizar_varios(uuid, integer[], jsonb) to anon, authenticated;

-- Excluir promoção do dono.
create or replace function public.promo_excluir(p_token uuid, p_id integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
  v_n   integer;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;
  delete from public.promocoes where id = p_id and profissional_id = v_pid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
grant execute on function public.promo_excluir(uuid, integer) to anon, authenticated;

-- Liga/desliga o seletor de promoções do PRÓPRIO perfil (antes qualquer
-- visitante podia alterar o seletor de qualquer profissional).
create or replace function public.promo_seletor(p_token uuid, p_habilitado boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_pid integer := public.sessao_profissional_id(p_token);
  v     boolean;
begin
  if v_pid is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  update public.profissionais
     set seletor_promocoes_habilitado = coalesce(p_habilitado, true)
   where id = v_pid
     returning seletor_promocoes_habilitado into v;

  return coalesce(v, false);
end;
$$;
grant execute on function public.promo_seletor(uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- FECHAR A PORTA: leitura pública (catálogo), escrita só via RPC.
--   * LEITURA continua liberada por policy (o cliente precisa ver para
--     agendar) — mas apenas SELECT: anon não escreve mais direto.
--   * As RPCs acima são security definer, então ignoram RLS.
-- ---------------------------------------------------------------------
alter table public.servicos enable row level security;
alter table public.promocoes enable row level security;

drop policy if exists "leitura_publica_servicos" on public.servicos;
create policy "leitura_publica_servicos" on public.servicos
  for select to anon, authenticated using (true);

drop policy if exists "leitura_publica_promocoes" on public.promocoes;
create policy "leitura_publica_promocoes" on public.promocoes
  for select to anon, authenticated using (true);

revoke insert, update, delete on table public.servicos from anon, authenticated;
revoke insert, update, delete on table public.promocoes from anon, authenticated;

-- ---------------------------------------------------------------------
--  VERIFICAÇÃO (rode e confira ANTES de publicar o app novo):
--    -- Escrita direta deve FALHAR (permission denied for table ...):
--    --   update public.servicos set valor = 1 where id = 1;
--    --   insert into public.promocoes (profissional_id, servico) values (1, 'x');
--    -- Leitura deve continuar OK:
--    --   select * from public.servicos limit 1;
--    --   select * from public.promocoes limit 1;
--    -- Com um token válido (da sessao_abrir):
--    --   select * from public.serv_criar('TOKEN', 'Corte', 50, '1 hora');
--    --   select * from public.promo_criar('TOKEN', 'Corte', 35, '1 hora');
--    --   select public.promo_seletor('TOKEN', false);
-- ---------------------------------------------------------------------

-- =====================================================================
--  BLOCO DE ROLLBACK — descomente para voltar ao acesso direto anterior
--  (o app antigo volta a funcionar):
-- =====================================================================
-- alter table public.servicos disable row level security;
-- alter table public.promocoes disable row level security;
-- drop policy if exists "leitura_publica_servicos" on public.servicos;
-- drop policy if exists "leitura_publica_promocoes" on public.promocoes;
-- grant insert, update, delete on table public.servicos to anon, authenticated;
-- grant insert, update, delete on table public.promocoes to anon, authenticated;
-- drop function if exists public.promo_seletor(uuid, boolean);
-- drop function if exists public.promo_excluir(uuid, integer);
-- drop function if exists public.promo_atualizar_varios(uuid, integer[], jsonb);
-- drop function if exists public.promo_atualizar(uuid, integer, jsonb);
-- drop function if exists public.promo_criar(uuid, text, numeric, text);
-- drop function if exists public.serv_excluir(uuid, integer);
-- drop function if exists public.serv_atualizar(uuid, integer, jsonb);
-- drop function if exists public.serv_criar(uuid, text, numeric, text);
