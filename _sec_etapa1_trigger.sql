-- ============================================================
-- BLINDAGEM DE SENHAS (camada por camada, sem quebrar o app)
-- Execute no Supabase -> SQL Editor. Reversivel.
-- ============================================================

-- 1) Coluna de hash (bcrypt). Se ja existir, nao faz nada.
alter table public.profissionais
  add column if not exists senha_hash text;

-- 2) Funcao + trigger que mantem senha_hash sempre em sincronia
--    com a coluna senha (em texto puro). Assim, criar/editar
--    profissional continua funcionando do jeito que esta, mas o
--    hash fica sempre valido para o login seguro.
create or replace function public.sync_senha_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.senha is distinct from old.senha then
    if new.senha is null or new.senha = '' then
      new.senha_hash := null;
    else
      new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt('bf'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_senha_hash on public.profissionais;
create trigger trg_sync_senha_hash
before insert or update of senha on public.profissionais
for each row execute function public.sync_senha_hash();

-- 3) Preenche o hash de todos os registros atuais (idempotente).
update public.profissionais
set senha_hash = extensions.crypt(senha, extensions.gen_salt('bf'))
where senha is not null and senha <> ''
  and (senha_hash is null or senha_hash not like '$2%');

-- 4) Confere: quantos tem hash valido (deve cobrir todos com senha).
select
  count(*) filter (where senha is not null and senha <> '') as com_senha,
  count(*) filter (where senha_hash like '$2%')             as com_hash
from public.profissionais;
