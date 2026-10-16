-- =====================================================================
--  BLINDAGEM DO PERFIL (profissionais) — rode no SQL do Supabase
--  ------------------------------------------------------------------
--  Fecha o buraco mais grave: com RLS desligado, qualquer visitante fazia
--      select senha from profissionais
--  e via a senha em texto puro de TODOS os profissionais.
--
--  O que faz (camada por camada, sem quebrar o app):
--   1) Esconde `senha` e `senha_hash` da LEITURA da chave pública
--      (column-level grant). O `select *` do app continua funcionando,
--      só não retorna mais as colunas de senha.
--   2) RPC `admin_ver_senha` — só um super_admin autenticado (token)
--      consegue ver uma senha. Substitui o "👁️ Ver senha" do painel.
--   3) RPC `push_verify_token` — o push passa a se autenticar pelo token
--      de sessão em vez da senha pura.
--
--  Idempotente. Reversível: role o BLOCO DE ROLLBACK no fim.
--  ⚠️ Requer o token de sessão (rode ANTES _blindagem_agendamentos.sql,
--     que cria a tabela sessoes_profissional e sessao_profissional_id).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) ESCONDER A SENHA DA LEITURA PÚBLICA
--    Revoga o SELECT irrestrito e reconcede apenas as colunas seguras
--    (todas EXCETO senha e senha_hash). INSERT/UPDATE/DELETE seguem
--    como estão, então criar/editar profissional continua funcionando.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  cols text;
BEGIN
  REVOKE SELECT ON public.profissionais FROM anon, authenticated;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profissionais'
     AND column_name NOT IN ('senha', 'senha_hash');

  EXECUTE format(
    'GRANT SELECT (%s) ON public.profissionais TO anon, authenticated',
    cols
  );
END $$;

-- ---------------------------------------------------------------------
-- 2) admin_ver_senha(p_token, p_id): só um super_admin autenticado vê a
--    senha de um profissional. Substitui o "👁️ Ver senha" do painel.
-- ---------------------------------------------------------------------
create or replace function public.admin_ver_senha(p_token uuid, p_id integer)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id integer := public.sessao_profissional_id(p_token);
  v_tipo     text;
  v_senha    text;
begin
  if v_admin_id is null then
    raise exception 'sessao_invalida' using errcode = '28000';
  end if;

  -- Só super_admin pode ver senhas.
  select tipo into v_tipo from public.profissionais where id = v_admin_id;
  if v_tipo is distinct from 'super_admin' then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  select senha into v_senha from public.profissionais where id = p_id;
  if not found then
    raise exception 'profissional_inexistente' using errcode = 'P0001';
  end if;

  return v_senha;
end;
$$;
grant execute on function public.admin_ver_senha(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) push_verify_token(p_token): autentica o profissional pelo token de
--    sessão (em vez da senha pura). Devolve {id, ativo} do dono do token.
--    A Edge Function manage-push-device passa a chamar esta RPC.
-- ---------------------------------------------------------------------
create or replace function public.push_verify_token(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    integer := public.sessao_profissional_id(p_token);
  v_ativo boolean;
begin
  if v_id is null then
    return null;
  end if;
  select ativo into v_ativo from public.profissionais where id = v_id;
  if not found then
    return null;
  end if;
  return json_build_object('id', v_id, 'ativo', v_ativo);
end;
$$;
grant execute on function public.push_verify_token(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
--  VERIFICAÇÃO (confira ANTES de publicar o app novo):
--    -- Como ANON (simule o atacante): deve vir VAZIO em senha.
--    select * from public.profissionais limit 1;
--    -- Deve falhar/dar vazio:
--    select senha from public.profissionais limit 1;
-- ---------------------------------------------------------------------

-- =====================================================================
--  BLOCO DE ROLLBACK (descomente para voltar a expor a senha como antes):
-- =====================================================================
-- grant select on public.profissionais to anon, authenticated;
-- drop function if exists public.push_verify_token(uuid);
-- drop function if exists public.admin_ver_senha(uuid, integer);
