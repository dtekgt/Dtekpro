-- D-TEK GT Web OS v15 — Portal cliente
-- Propiedad de D-TEK GT / Dominic Morales.
-- Correr después de 01_schema.sql, 02_seed_services.sql, 03_scheduler_rpc.sql y 04_admin_workflow.sql.
-- Objetivo: que el cliente pueda crear cuenta, reclamar citas por correo, guardar vehículos y ver historial.

-- Perfil del cliente: actualizar nombre/teléfono propio
create or replace function public.dtek_client_update_profile(
  p_full_name text,
  p_phone text
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

  insert into public.profiles (id, email, full_name, phone, role)
  values (auth.uid(), auth.email(), coalesce(p_full_name, ''), coalesce(p_phone, ''), 'client')
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

-- Reclamar citas creadas desde agenda pública usando el mismo correo del login
create or replace function public.dtek_client_claim_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.appointments
  set client_id = auth.uid(),
      updated_at = now()
  where lower(client_email) = lower(auth.email())
    and (client_id is null or client_id = auth.uid());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Crear vehículo propio
create or replace function public.dtek_client_create_vehicle(
  p_brand text,
  p_line text,
  p_year int,
  p_plate text default null,
  p_vin text default null,
  p_notes text default null
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

  if nullif(trim(coalesce(p_brand, '')), '') is null then
    raise exception 'BRAND_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_line, '')), '') is null then
    raise exception 'LINE_REQUIRED';
  end if;

  insert into public.vehicles (owner_id, brand, line, year, plate, vin, notes)
  values (auth.uid(), trim(p_brand), trim(p_line), p_year, nullif(trim(coalesce(p_plate, '')), ''), nullif(trim(coalesce(p_vin, '')), ''), nullif(trim(coalesce(p_notes, '')), ''))
  returning * into v_vehicle;

  return v_vehicle;
end;
$$;

-- Citas visibles para el cliente: por client_id o por correo autenticado
create or replace function public.dtek_client_list_my_appointments()
returns table (
  id uuid,
  service_id text,
  service_name text,
  service_category text,
  service_price text,
  client_name text,
  client_email text,
  client_phone text,
  vehicle_brand text,
  vehicle_line text,
  vehicle_year int,
  vehicle_summary text,
  location text,
  city text,
  symptom text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text,
  source text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.service_id,
    s.name as service_name,
    s.category as service_category,
    s.price_from as service_price,
    a.client_name,
    a.client_email,
    a.client_phone,
    a.vehicle_brand,
    a.vehicle_line,
    a.vehicle_year,
    concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text) as vehicle_summary,
    a.location,
    a.city,
    a.symptom,
    a.scheduled_start,
    a.scheduled_end,
    a.status,
    a.source,
    a.created_at
  from public.appointments a
  left join public.services s on s.id = a.service_id
  where auth.uid() is not null
    and (a.client_id = auth.uid() or lower(a.client_email) = lower(auth.email()))
  order by a.scheduled_start desc;
$$;

-- Historial técnico / órdenes visibles para el cliente
create or replace function public.dtek_client_list_my_work_orders()
returns table (
  id uuid,
  appointment_id uuid,
  service_name text,
  vehicle_summary text,
  scheduled_start timestamptz,
  diagnosis text,
  recommendations text,
  parts_notes text,
  labor_total numeric,
  parts_total numeric,
  grand_total numeric,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    wo.id,
    wo.appointment_id,
    s.name as service_name,
    concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text) as vehicle_summary,
    a.scheduled_start,
    wo.diagnosis,
    wo.recommendations,
    wo.parts_notes,
    wo.labor_total,
    wo.parts_total,
    wo.grand_total,
    wo.status,
    wo.created_at
  from public.work_orders wo
  join public.appointments a on a.id = wo.appointment_id
  left join public.services s on s.id = a.service_id
  where auth.uid() is not null
    and (a.client_id = auth.uid() or lower(a.client_email) = lower(auth.email()))
  order by wo.created_at desc;
$$;

grant execute on function public.dtek_client_update_profile(text, text) to authenticated;
grant execute on function public.dtek_client_claim_appointments() to authenticated;
grant execute on function public.dtek_client_create_vehicle(text, text, int, text, text, text) to authenticated;
grant execute on function public.dtek_client_list_my_appointments() to authenticated;
grant execute on function public.dtek_client_list_my_work_orders() to authenticated;
