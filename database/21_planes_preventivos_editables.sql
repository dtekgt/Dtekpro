-- =====================================================================
-- D-TEK GT · Planes preventivos editables v34 — 29 jul 2026
-- Ejecutar UNA VEZ después de database/20_estado_vehiculo.sql.
-- No borra datos. Permite que el admin ajuste intervalos por vehículo.
-- =====================================================================

alter table public.vehicle_component_events
  add column if not exists interval_months int,
  add column if not exists interval_km int,
  add column if not exists plan_title text,
  add column if not exists plan_source text,
  add column if not exists plan_url text,
  add column if not exists plan_note text;

create or replace function public.dtek_admin_save_vehicle_inspections(
  p_appointment_id uuid,
  p_inspections jsonb default '[]'::jsonb
)
returns setof public.vehicle_component_events
language plpgsql security definer set search_path=public
as $$
declare
  v_vehicle uuid;
  v_order uuid;
  v_mileage int;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Solo un administrador puede guardar revisiones.';
  end if;

  select a.vehicle_id,w.id,coalesce(w.mileage_at_service,v.mileage)
    into v_vehicle,v_order,v_mileage
  from public.appointments a
  left join public.work_orders w on w.appointment_id=a.id
  left join public.vehicles v on v.id=a.vehicle_id
  where a.id=p_appointment_id;

  if v_vehicle is null then raise exception 'La cita no tiene vehículo vinculado.'; end if;

  if v_mileage is not null then
    update public.vehicles set mileage=v_mileage where id=v_vehicle;
  end if;

  return query
  insert into public.vehicle_component_events(
    vehicle_id,appointment_id,work_order_id,component_key,status,source,
    notes,measured_value,mileage,inspected_at,created_by,
    interval_months,interval_km,plan_title,plan_source,plan_url,plan_note
  )
  select v_vehicle,p_appointment_id,v_order,
    trim(x->>'component_key'),coalesce(nullif(x->>'status',''),'unknown'),'dtek',
    nullif(trim(x->>'notes'),''),nullif(trim(x->>'measured_value'),''),
    v_mileage,now(),auth.uid(),
    nullif(x->>'interval_months','')::int,
    nullif(x->>'interval_km','')::int,
    nullif(trim(x->>'plan_title'),''),
    nullif(trim(x->>'plan_source'),''),
    nullif(trim(x->>'plan_url'),''),
    nullif(trim(x->>'plan_note'),'')
  from jsonb_array_elements(coalesce(p_inspections,'[]'::jsonb)) x
  where trim(coalesce(x->>'component_key','')) <> ''
    and coalesce(x->>'status','') in ('ok','monitor','attention','serviced','unknown')
  on conflict (work_order_id,component_key) where work_order_id is not null
  do update set
    status=excluded.status,
    source='dtek',
    notes=excluded.notes,
    measured_value=excluded.measured_value,
    mileage=excluded.mileage,
    inspected_at=excluded.inspected_at,
    created_by=excluded.created_by,
    interval_months=coalesce(excluded.interval_months,vehicle_component_events.interval_months),
    interval_km=coalesce(excluded.interval_km,vehicle_component_events.interval_km),
    plan_title=coalesce(excluded.plan_title,vehicle_component_events.plan_title),
    plan_source=coalesce(excluded.plan_source,vehicle_component_events.plan_source),
    plan_url=coalesce(excluded.plan_url,vehicle_component_events.plan_url),
    plan_note=coalesce(excluded.plan_note,vehicle_component_events.plan_note)
  returning *;
end;
$$;

grant execute on function public.dtek_admin_save_vehicle_inspections(uuid,jsonb) to authenticated;

