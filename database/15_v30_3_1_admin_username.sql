-- D-TEK WEB v30.3.1
-- Permite iniciar sesión con usuario también en cuentas admin/existentes
-- que usan un correo real en Supabase Auth.

create or replace function public.dtek_public_resolve_login(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_identifier text := lower(trim(coalesce(p_identifier, '')));
  v_username text;
  v_login_email text;
begin
  if v_identifier = '' then return null; end if;

  if position('@' in v_identifier) > 0 then
    select p.email into v_login_email
    from public.profiles p
    where lower(p.contact_email) = v_identifier
       or lower(p.email) = v_identifier
    order by case when lower(p.contact_email) = v_identifier then 0 else 1 end, p.updated_at desc
    limit 1;
    return coalesce(v_login_email, v_identifier);
  end if;

  v_username := public.dtek_normalize_username(v_identifier);
  select p.email into v_login_email
  from public.profiles p
  where lower(p.username) = v_username
  limit 1;

  return v_login_email;
end;
$$;

grant execute on function public.dtek_public_resolve_login(text) to anon, authenticated;
