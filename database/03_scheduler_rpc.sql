-- D-TEK GT Web OS v10 — Agenda real Supabase RPC
-- Correr en Supabase SQL Editor después de 01_schema.sql y 02_seed_services.sql.

create or replace function public.dtek_get_busy_blocks(
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  id text,
  source text,
  service_id text,
  block_start timestamptz,
  block_end timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id::text as id,
    'appointment'::text as source,
    a.service_id,
    a.block_start,
    a.block_end,
    a.status
  from public.appointments a
  where a.status <> 'cancelled'
    and a.block_start < p_end
    and a.block_end > p_start
  union all
  select
    b.id::text as id,
    'blocked_time'::text as source,
    null::text as service_id,
    b.start_time as block_start,
    b.end_time as block_end,
    'blocked'::text as status
  from public.blocked_times b
  where b.start_time < p_end
    and b.end_time > p_start;
$$;

grant execute on function public.dtek_get_busy_blocks(timestamptz, timestamptz) to anon, authenticated;

create or replace function public.dtek_create_public_appointment(
  p_service_id text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_vehicle_brand text,
  p_vehicle_line text,
  p_vehicle_year int,
  p_vehicle_moves text,
  p_location text,
  p_city text,
  p_symptom text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_block_start timestamptz,
  p_block_end timestamptz,
  p_source text default 'web-agenda'
)
returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_service_id is null or not exists (select 1 from public.services where id = p_service_id and active = true) then
    raise exception 'Servicio inválido o inactivo';
  end if;

  if p_client_name is null or length(trim(p_client_name)) < 2 then
    raise exception 'Nombre requerido';
  end if;

  if p_client_email is null or position('@' in p_client_email) = 0 then
    raise exception 'Correo requerido';
  end if;

  if p_scheduled_start >= p_scheduled_end or p_block_start >= p_block_end then
    raise exception 'Horario inválido';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.status <> 'cancelled'
      and p_block_start < a.block_end
      and a.block_start < p_block_end
  ) or exists (
    select 1 from public.blocked_times b
    where p_block_start < b.end_time
      and b.start_time < p_block_end
  ) then
    raise exception 'schedule_conflict: ese horario ya está ocupado o bloqueado';
  end if;

  return query
  insert into public.appointments (
    service_id,
    client_name,
    client_email,
    client_phone,
    vehicle_brand,
    vehicle_line,
    vehicle_year,
    vehicle_moves,
    location,
    city,
    symptom,
    scheduled_start,
    scheduled_end,
    block_start,
    block_end,
    status,
    source
  ) values (
    p_service_id,
    trim(p_client_name),
    lower(trim(p_client_email)),
    nullif(trim(coalesce(p_client_phone, '')), ''),
    nullif(trim(coalesce(p_vehicle_brand, '')), ''),
    nullif(trim(coalesce(p_vehicle_line, '')), ''),
    p_vehicle_year,
    nullif(trim(coalesce(p_vehicle_moves, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_symptom, '')), ''),
    p_scheduled_start,
    p_scheduled_end,
    p_block_start,
    p_block_end,
    'requested',
    coalesce(nullif(trim(p_source), ''), 'web-agenda')
  )
  returning *;
end;
$$;

grant execute on function public.dtek_create_public_appointment(
  text, text, text, text, text, text, int, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text
) to anon, authenticated;
