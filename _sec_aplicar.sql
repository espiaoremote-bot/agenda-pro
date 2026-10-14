-- ===== BLINDAGEM DE SENHAS (idempotente) =====

-- 1. Garante a coluna de hash
alter table public.profissionais add column if not exists senha_hash text;

-- 2. Preenche hash bcrypt das senhas atuais (onde faltar)
update public.profissionais
set senha_hash = extensions.crypt(senha, extensions.gen_salt('bf', 8))
where senha is not null and (senha_hash is null or senha_hash = '');

-- 3. Trigger que mantem o hash sincronizado ao editar senha
create or replace function public.sync_senha_hash() returns trigger as $$
begin
  if new.senha is distinct from old.senha then
    new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt('bf', 8));
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists trg_sync_senha_hash on public.profissionais;
create trigger trg_sync_senha_hash before update on public.profissionais
for each row execute function public.sync_senha_hash();

-- 4. Funcao de login segura (compara por hash, nao expoe a senha pura)
create or replace function public.profissionais_login(p_nome text, p_senha text)
returns setof public.profissionais as $$
begin
  return query
    select *
    from public.profissionais
    where nome = p_nome
      and senha_hash = extensions.crypt(p_senha, senha_hash);
end;
$$ language plpgsql security definer set search_path = public, extensions;
