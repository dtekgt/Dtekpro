-- D-TEK GT Web OS v16 — Vehículo → servicio → historial
-- Correr después de 01_schema.sql, 02_seed_services.sql, 03_scheduler_rpc.sql, 04_admin_workflow.sql y 06_client_portal.sql.
-- Objetivo: asociar citas a vehículos guardados, solicitar servicio para un carro y ver historial por vehículo.

-- Obtener un vehículo propio por ID
create or replace function public.dtek_client_get_vehicle(
  p_vehicle_id uuid
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
    and owner_id = auth.uid();

  if v_vehicle.id is null then
    raise exception 'VEHICLE_NOT_FOUND_OR_NOT_OWNER';
  end if;

  return v_vehicle;
end;
$$;

-- Crear cita para un vehículo ya guardado del cliente
create or replace function public.dtek_client_create_appointment_for_vehicle(
  p_vehicle_id uuid,
  p_service_id text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_vehicle_moves text,
  p_location text,
  p_city text,
  p_symptom text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_block_start timestamptz,
  p_block_end timestamptz,
  p_source text default 'client-portal-vehicle'
)
returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
    and owner_id = auth.uid();

  if v_vehicle.id is null then
    raise exception 'VEHICLE_NOT_FOUND_OR_NOT_OWNER';
  end if;

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
    client_id,
    vehicle_id,
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
    auth.uid(),
    v_vehicle.id,
    p_service_id,
    trim(p_client_name),
    lower(trim(p_client_email)),
    nullif(trim(coalesce(p_client_phone, '')), ''),
    v_vehicle.brand,
    v_vehicle.line,
    v_vehicle.year,
    nullif(trim(coalesce(p_vehicle_moves, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_symptom, '')), ''),
    p_scheduled_start,
    p_scheduled_end,
    p_block_start,
    p_block_end,
    'requested',
    coalesce(nullif(trim(p_source), ''), 'client-portal-vehicle')
  )
  returning *;
end;
$$;

-- Historial completo de un vehículo del cliente
create or replace function public.dtek_client_list_vehicle_history(
  p_vehicle_id uuid
)
returns table (
  id uuid,
  kind text,
  appointment_id uuid,
  service_id text,
  service_name text,
  service_price text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  appointment_status text,
  work_order_status text,
  symptom text,
  location text,
  diagnosis text,
  recommendations text,
  parts_notes text,
  labor_total numeric,
  parts_total numeric,
  grand_total numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(wo.id, a.id) as id,
    case when wo.id is null then 'appointment' else 'work_order' end as kind,
    a.id as appointment_id,
    a.service_id,
    s.name as service_name,
    s.price_from as service_price,
    a.scheduled_start,
    a.scheduled_end,
    a.status as appointment_status,
    wo.status as work_order_status,
    a.symptom,
    a.location,
    wo.diagnosis,
    wo.recommendations,
    wo.parts_notes,
    wo.labor_total,
    wo.parts_total,
    wo.grand_total,
    coalesce(wo.created_at, a.created_at) as created_at
  from public.appointments a
  join public.vehicles v on v.id = a.vehicle_id
  left join public.services s on s.id = a.service_id
  left join public.work_orders wo on wo.appointment_id = a.id
  where auth.uid() is not null
    and v.id = p_vehicle_id
    and v.owner_id = auth.uid()
  order by coalesce(a.scheduled_start, a.created_at) desc;
$$;

-- Admin: llenar/actualizar reporte técnico de una cita realizada o en proceso
create or replace function public.dtek_admin_upsert_work_order_report(
  p_appointment_id uuid,
  p_diagnosis text default null,
  p_recommendations text default null,
  p_parts_notes text default null,
  p_labor_total numeric default null,
  p_parts_total numeric default null,
  p_status text default 'completed'
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.work_orders;
  v_grand numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede guardar reportes técnicos';
  end if;

  if p_status not in ('open', 'quoted', 'approved', 'completed', 'cancelled') then
    raise exception 'Estado de orden inválido: %', p_status;
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'Cita no encontrada';
  end if;

  v_grand := coalesce(p_labor_total, 0) + coalesce(p_parts_total, 0);

  insert into public.work_orders (
    appointment_id,
    diagnosis,
    recommendations,
    parts_notes,
    labor_total,
    parts_total,
    grand_total,
    status
  ) values (
    p_appointment_id,
    nullif(trim(coalesce(p_diagnosis, '')), ''),
    nullif(trim(coalesce(p_recommendations, '')), ''),
    nullif(trim(coalesce(p_parts_notes, '')), ''),
    p_labor_total,
    p_parts_total,
    case when p_labor_total is null and p_parts_total is null then null else v_grand end,
    p_status
  )
  on conflict (appointment_id) do update set
    diagnosis = excluded.diagnosis,
    recommendations = excluded.recommendations,
    parts_notes = excluded.parts_notes,
    labor_total = excluded.labor_total,
    parts_total = excluded.parts_total,
    grand_total = excluded.grand_total,
    status = excluded.status,
    updated_at = now()
  returning * into v_order;

  insert into public.communications (appointment_id, type, direction, content)
  values (p_appointment_id, 'note', 'internal', 'Reporte técnico actualizado desde admin D-TEK');

  return v_order;
end;
$$;

-- Asegurar que work_orders tenga una restricción única por cita para upsert
create unique index if not exists work_orders_appointment_id_unique on public.work_orders(appointment_id);

grant execute on function public.dtek_client_get_vehicle(uuid) to authenticated;
grant execute on function public.dtek_client_create_appointment_for_vehicle(uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.dtek_client_list_vehicle_history(uuid) to authenticated;
grant execute on function public.dtek_admin_upsert_work_order_report(uuid, text, text, text, numeric, numeric, text) to authenticated;
