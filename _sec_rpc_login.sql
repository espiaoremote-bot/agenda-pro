-- Etapa 2 (aditiva e segura): login validado por hash, sem expor a coluna senha.
create extension if not exists pgcrypto with schema extensions;

-- Visao publica segura: todas as colunas de profissionais EXCETO senha/senha_hash.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profissionais'
    AND column_name NOT IN ('senha', 'senha_hash');
  EXECUTE format('create or replace view public.profissionais_publico as select %s from public.profissionais', cols);
END $$;

-- RPC de login: compara a senha informada com o hash (bcrypt) no servidor.
create or replace function public.profissionais_login(p_nome text, p_senha text)
returns setof public.profissionais_publico
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select vp.*
  from public.profissionais_publico vp
  where vp.id in (
    select p.id
    from public.profissionais p
    where p.nome = p_nome
      and p.senha_hash is not null
      and p.senha_hash = extensions.crypt(p_senha, p.senha_hash)
  );
end;
$$;

-- Permite que o app (chave anon) chame a RPC.
grant execute on function public.profissionais_login(text, text) to anon, authenticated;