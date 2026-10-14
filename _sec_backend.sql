create or replace function public.sync_profissionais_senha_hash()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = ''INSERT'' then
    if new.senha is not null then
      new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt(''bf'', 10));
    end if;
  elsif new.senha is distinct from old.senha then
    if new.senha is not null then
      new.senha_hash := extensions.crypt(new.senha, extensions.gen_salt(''bf'', 10));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_profissionais_senha_hash on public.profissionais;
create trigger trg_sync_profissionais_senha_hash before insert or update of senha on public.profissionais for each row execute function public.sync_profissionais_senha_hash();
create or replace function public.profissionais_login(p_nome text, p_senha text)
returns setof public.profissionais language plpgsql security definer set search_path = public, extensions as $$
begin
  return query select p.* from public.profissionais p
  where p.nome = p_nome and p.senha_hash is not null
    and p.senha_hash = extensions.crypt(p_senha, p.senha_hash);
end;
$$;
grant execute on function public.profissionais_login(text, text) to anon, authenticated, service_role;
update public.profissionais set senha_hash = extensions.crypt(senha, extensions.gen_salt(''bf'', 10)) where senha_hash is null and senha is not null;