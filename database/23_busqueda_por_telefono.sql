-- D-TEK GT Web OS v31 — Búsqueda por teléfono para autocompletar la agenda
-- Correr en Supabase SQL Editor después de los SQL anteriores.
-- Objetivo: si alguien ya escribió su carro y sus datos antes (Garage, cita de invitado,
-- o un link armado desde el panel admin), que no tenga que volver a escribirlos.
-- No reemplaza el login del Garage — eso sigue con contraseña hasta que se decida
-- un segundo factor (código por WhatsApp) para ese caso específico.

-- Deja solo los últimos 8 dígitos, sin importar cómo se haya escrito el teléfono
-- (+502 5875 2219, 58752219, 5875-2219, etc. todos matchean igual).
create or replace function public.dtek_normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8), '');
$$;

-- Bitácora simple para frenar fuerza bruta: cuántas veces se consultó cada número.
create table if not exists public.dtek_phone_lookup_log (
  id bigserial primary key,
  phone_key text not null,
  requested_at timestamptz not null default now()
);

create index if not exists dtek_phone_lookup_log_phone_time_idx
  on public.dtek_phone_lookup_log (phone_key, requested_at);

alter table public.dtek_phone_lookup_log enable row level security;
-- Sin políticas = nadie la lee ni escribe directo desde el cliente.
-- Solo la función de abajo (security definer) escribe en ella.

create or replace function public.dtek_lookup_by_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_recent_count int;
  v_profile record;
  v_appt record;
  v_vehicles jsonb;
begin
  v_key := public.dtek_normalize_phone(p_phone);
  if v_key is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*) into v_recent_count
  from public.dtek_phone_lookup_log
  where phone_key = v_key and requested_at > now() - interval '10 minutes';

  if v_recent_count >= 6 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.dtek_phone_lookup_log (phone_key) values (v_key);

  -- 1) Cliente con cuenta en el Garage: trae sus carros guardados.
  -- El perfil no guarda zona/dirección (solo nombre, teléfono, correo) —
  -- esos dos se rescatan de su cita más reciente si existe una.
  select p.id, p.full_name, p.phone, p.email
  into v_profile
  from public.profiles p
  where public.dtek_normalize_phone(p.phone) = v_key
  order by p.updated_at desc
  limit 1;

  if v_profile.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'brand', veh.brand, 'line', veh.line, 'year', veh.year, 'engine', veh.engine
    ) order by veh.updated_at desc), '[]'::jsonb)
    into v_vehicles
    from public.vehicles veh
    where veh.owner_id = v_profile.id;

    select a.city, a.location
    into v_appt
    from public.appointments a
    where a.client_id = v_profile.id
       or lower(a.client_email) = lower(v_profile.email)
    order by a.created_at desc
    limit 1;

    return jsonb_build_object(
      'found', true,
      'source', 'profile',
      'name', v_profile.full_name,
      'email', v_profile.email,
      'phone', v_profile.phone,
      'city', v_appt.city,
      'location', v_appt.location,
      'vehicles', v_vehicles
    );
  end if;

  -- 2) Sin cuenta, pero ya agendó antes como invitado (o vía un link tuyo).
  select a.client_name, a.client_email, a.city, a.location,
         a.vehicle_brand, a.vehicle_line, a.vehicle_year, a.vehicle_moves
  into v_appt
  from public.appointments a
  where public.dtek_normalize_phone(a.client_phone) = v_key
  order by a.created_at desc
  limit 1;

  if v_appt.client_name is not null then
    return jsonb_build_object(
      'found', true,
      'source', 'appointment',
      'name', v_appt.client_name,
      'email', v_appt.client_email,
      'city', v_appt.city,
      'location', v_appt.location,
      'vehicles', jsonb_build_array(jsonb_build_object(
        'brand', v_appt.vehicle_brand, 'line', v_appt.vehicle_line,
        'year', v_appt.vehicle_year, 'moves', v_appt.vehicle_moves
      ))
    );
  end if;

  return jsonb_build_object('found', false);
end;
$$;

grant execute on function public.dtek_lookup_by_phone(text) to anon, authenticated;
