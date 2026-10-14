create or replace function public.profissionais_login(p_nome text, p_senha text)
returns setof public.profissionais
language sql
security definer
set search_path = public
as $fn$
  select *
  from public.profissionais
  where nome = p_nome
    and senha_hash is not null
    and senha_hash = crypt(p_senha, senha_hash)
  limit 1;
$fn$;
