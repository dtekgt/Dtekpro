-- D-TEK GT Web OS v20 — Perfil enriquecido / flujo tipo río
-- Correr después de los SQL anteriores.
-- Agrega datos de preferencia del cliente para que Mi D-TEK se sienta propio.

alter table public.profiles
  add column if not exists default_location text,
  add column if not exists default_city text,
  add column if not exists preferred_time_window text,
  add column if not exists contact_preference text;

-- Reemplaza la función básica por una versión compatible con datos extra.
drop function if exists public.dtek_client_update_profile(text, text);

create or replace function public.dtek_client_update_profile(
  p_full_name text,
  p_phone text,
  p_default_location text default null,
  p_default_city text default null,
  p_preferred_time_window text default null,
  p_contact_preference text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    default_location,
    default_city,
    preferred_time_window,
    contact_preference
  )
  values (
    auth.uid(),
    auth.email(),
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    'client',
    nullif(trim(coalesce(p_default_location, '')), ''),
    nullif(trim(coalesce(p_default_city, '')), ''),
    nullif(trim(coalesce(p_preferred_time_window, '')), ''),
    coalesce(nullif(trim(coalesce(p_contact_preference, '')), ''), 'WhatsApp')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    default_location = excluded.default_location,
    default_city = excluded.default_city,
    preferred_time_window = excluded.preferred_time_window,
    contact_preference = excluded.contact_preference,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.dtek_client_update_profile(text, text, text, text, text, text) to authenticated;
