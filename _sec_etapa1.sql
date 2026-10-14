-- ============================================================
-- BLINDAGEM DE SENHAS - ETAPA 1 (segura, nao quebra o app)
-- 1) trigger que mantem senha_hash (bcrypt) sincronizado com senha
-- 2) RPC de login que valida por hash, sem expor comparacao
-- ============================================================
create extension if not exists pgcrypto;

-- Trigger: sempre que inserir/atualizar a coluna senha, gera o hash bcrypt
create or replace function public.sync_senha_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' or new.senha is distinct from old.senha then
    if new.senha is null or new.senha = '' then
      new.senha_hash := null;
    elsif new.senha like '$2a$%' or new.senha like '$2b$%' or new.senha like '$2y$%' then
      -- ja eh um hash, apenas copia
      new.senha_hash := new.senha;
    else
      new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt('bf', 10));
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_sync_senha_hash on public.profissionais;
create trigger trg_sync_senha_hash
before insert or update of senha on public.profissionais
for each row execute function public.sync_senha_hash();

-- RPC de login: valida a senha por bcrypt e devolve o registro (security definer)
create or replace function public.profissionais_login(p_nome text, p_senha text)
returns setof public.profissionais
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  return query
  select p.*
  from public.profissionais p
  where p.nome = p_nome
    and p.senha_hash is not null
    and p.senha_hash = extensions.crypt(p_senha, p.senha_hash)
  limit 1;
end;
$fn$;

-- Permissoes: o app (anon/authenticated) pode EXECUTAR a RPC de login
grant execute on function public.profissionais_login(text, text) to anon, authenticated;
