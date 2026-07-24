-- D-TEK GT Web OS v30.3 — Acceso local por usuario o correo
-- Correr DESPUÉS de database/13_v27_points_rewards.sql.
-- Este archivo NO usa service_role ni expone contraseñas.

alter table public.profiles
  add column if not exists username text,
  add column if not exists contact_email text,
  add column if not exists access_mode text not null default 'email',
  add column if not exists must_change_password boolean not null default false,
  add column if not exists credentials_issued_at timestamptz;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_contact_email_idx
  on public.profiles (lower(contact_email))
  where contact_email is not null;

create or replace function public.dtek_normalize_username(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '.' from regexp_replace(
    regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9._]+', '', 'g'),
    '[._]{2,}', '.', 'g'
  ));
$$;

-- Los correos reales existentes se conservan como contacto. Las cuentas locales
-- nuevas usan @login.dtekgt.com únicamente como identificador interno de Supabase.
update public.profiles
set contact_email = email
where contact_email is null
  and email is not null
  and lower(email) not like '%@login.dtekgt.com';

update public.profiles
set access_mode = case
  when lower(coalesce(email, '')) like '%@login.dtekgt.com' then 'local'
  else access_mode
end;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._]{2,29}$');

alter table public.profiles drop constraint if exists profiles_access_mode_check;
alter table public.profiles add constraint profiles_access_mode_check
  check (access_mode in ('local', 'email', 'google'));

-- Crear el perfil con usuario/contacto desde metadata de Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_contact_email text;
  v_access_mode text;
  v_must_change boolean;
begin
  v_username := public.dtek_normalize_username(new.raw_user_meta_data->>'username');
  if v_username !~ '^[a-z0-9][a-z0-9._]{2,29}$' then
    v_username := null;
  end if;

  v_contact_email := nullif(lower(trim(coalesce(new.raw_user_meta_data->>'contact_email', ''))), '');
  if v_contact_email is null and lower(coalesce(new.email, '')) not like '%@login.dtekgt.com' then
    v_contact_email := lower(new.email);
  end if;

  v_access_mode := coalesce(nullif(new.raw_user_meta_data->>'access_mode', ''),
    case
      when lower(coalesce(new.email, '')) like '%@login.dtekgt.com' then 'local'
      when coalesce(new.raw_app_meta_data->>'provider', '') = 'google' then 'google'
      else 'email'
    end
  );
  if v_access_mode not in ('local', 'email', 'google') then v_access_mode := 'email'; end if;

  v_must_change := coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false);

  insert into public.profiles (
    id, email, contact_email, username, full_name, phone, role,
    access_mode, must_change_password, credentials_issued_at
  ) values (
    new.id,
    lower(new.email),
    v_contact_email,
    v_username,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'client'),
    v_access_mode,
    v_must_change,
    case when v_must_change then now() else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    contact_email = coalesce(public.profiles.contact_email, excluded.contact_email),
    username = coalesce(public.profiles.username, excluded.username),
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    access_mode = excluded.access_mode,
    updated_at = now();

  return new;
end;
$$;

-- Resolver público: correo conocido -> correo interno; usuario local -> correo interno.
-- Para usuarios locales el correo devuelto es sintético y no contiene datos personales.
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

create or replace function public.dtek_public_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.dtek_normalize_username(p_username) ~ '^[a-z0-9][a-z0-9._]{2,29}$'
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = public.dtek_normalize_username(p_username)
    );
$$;

create or replace function public.dtek_public_contact_email_available(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '') is null
    or not exists (
      select 1 from public.profiles p
      where lower(p.contact_email) = lower(trim(p_email))
         or lower(p.email) = lower(trim(p_email))
    );
$$;

create or replace function public.dtek_client_update_access(
  p_username text default null,
  p_contact_email text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_username text := public.dtek_normalize_username(p_username);
  v_contact_email text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
  v_is_local boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_contact_email is not null and position('@' in v_contact_email) < 2 then raise exception 'EMAIL_INVALID'; end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_contact_email is not null and exists (
    select 1 from public.profiles p
    where p.id <> auth.uid()
      and (lower(p.contact_email) = v_contact_email or lower(p.email) = v_contact_email)
  ) then
    raise exception 'EMAIL_ALREADY_REGISTERED';
  end if;
  v_is_local := lower(coalesce(v_profile.email, '')) like '%@login.dtekgt.com';

  if v_is_local then
    if v_username !~ '^[a-z0-9][a-z0-9._]{2,29}$' then raise exception 'USERNAME_INVALID'; end if;
    update public.profiles
    set username = v_username,
        contact_email = v_contact_email,
        access_mode = 'local',
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
  else
    update public.profiles
    set contact_email = v_contact_email,
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;
  end if;

  return v_profile;
exception
  when unique_violation then raise exception 'USERNAME_TAKEN';
end;
$$;

create or replace function public.dtek_client_mark_password_changed()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.profiles
  set must_change_password = false, updated_at = now()
  where id = auth.uid();
  return true;
end;
$$;

-- Reclamar historial usando correo de contacto o correo interno.
create or replace function public.dtek_client_claim_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_contact_email text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select contact_email into v_contact_email from public.profiles where id = auth.uid();

  update public.appointments
  set client_id = auth.uid(), updated_at = now()
  where (
      lower(client_email) = lower(auth.email())
      or (v_contact_email is not null and lower(client_email) = lower(v_contact_email))
    )
    and (client_id is null or client_id = auth.uid());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Puntos: reconocer tanto email interno como correo opcional de contacto.
create or replace function public.dtek_award_completed_appointment_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_service text;
begin
  if new.status <> 'completed' then return new; end if;
  select
    coalesce(new.client_id, (
      select p.id from public.profiles p
      where lower(p.email) = lower(new.client_email)
         or lower(p.contact_email) = lower(new.client_email)
      order by p.updated_at desc limit 1
    )),
    coalesce((select s.name from public.services s where s.id = new.service_id), 'Servicio D-TEK')
  into v_owner, v_service;
  if v_owner is null then return new; end if;

  insert into public.points_ledger (owner_id, appointment_id, points, entry_type, description)
  values (v_owner, new.id, 10, 'service_points', v_service)
  on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
  do update set owner_id = excluded.owner_id, description = excluded.description;
  return new;
end;
$$;

create or replace function public.dtek_award_service_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_service text;
  v_total numeric;
  v_points integer;
  v_appointment uuid;
begin
  if new.status <> 'completed' then return new; end if;

  select a.id, coalesce(a.client_id, p.id), coalesce(s.name, 'Servicio D-TEK')
  into v_appointment, v_owner, v_service
  from public.appointments a
  left join public.profiles p on lower(p.email) = lower(a.client_email)
    or lower(p.contact_email) = lower(a.client_email)
  left join public.services s on s.id = a.service_id
  where a.id = new.appointment_id
  limit 1;

  if v_owner is null or v_appointment is null then return new; end if;
  v_total := coalesce(new.grand_total, coalesce(new.labor_total,0) + coalesce(new.parts_total,0), 0);
  v_points := greatest(10, floor(v_total / 10)::integer);

  insert into public.points_ledger (owner_id, appointment_id, work_order_id, points, entry_type, description)
  values (v_owner, v_appointment, new.id, v_points, 'service_points', v_service)
  on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
  do update set owner_id = excluded.owner_id, work_order_id = excluded.work_order_id, points = excluded.points, description = excluded.description;
  return new;
end;
$$;

grant execute on function public.dtek_public_resolve_login(text) to anon, authenticated;
grant execute on function public.dtek_public_username_available(text) to anon, authenticated;
grant execute on function public.dtek_public_contact_email_available(text) to anon, authenticated;
grant execute on function public.dtek_client_update_access(text, text) to authenticated;
grant execute on function public.dtek_client_mark_password_changed() to authenticated;
grant execute on function public.dtek_client_claim_appointments() to authenticated;

revoke all on function public.dtek_normalize_username(text) from public;
grant execute on function public.dtek_normalize_username(text) to anon, authenticated;
