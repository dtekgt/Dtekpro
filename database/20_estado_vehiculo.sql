-- =====================================================================
-- D-TEK GT · Estado del Vehículo v33 — 29 jul 2026
-- Ejecutar UNA VEZ después de database/19_lineas_de_recibo.sql.
-- No borra datos. Registra evidencia de inspecciones y servicios.
-- =====================================================================

create table if not exists public.vehicle_component_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  component_key text not null,
  status text not null default 'unknown'
    check (status in ('ok','monitor','attention','serviced','unknown')),
  source text not null default 'dtek'
    check (source in ('dtek','automatic','client')),
  notes text,
  measured_value text,
  mileage int,
  inspected_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_component_events_vehicle_idx
  on public.vehicle_component_events(vehicle_id, component_key, inspected_at desc);
create unique index if not exists vehicle_component_events_work_component_uidx
  on public.vehicle_component_events(work_order_id, component_key)
  where work_order_id is not null;

alter table public.vehicle_component_events enable row level security;

drop policy if exists vehicle_component_events_client_read on public.vehicle_component_events;
create policy vehicle_component_events_client_read
  on public.vehicle_component_events for select
  using (exists (
    select 1 from public.vehicles v
    where v.id = vehicle_component_events.vehicle_id and v.owner_id = auth.uid()
  ));

drop policy if exists vehicle_component_events_admin_all on public.vehicle_component_events;
create policy vehicle_component_events_admin_all
  on public.vehicle_component_events for all
  using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.dtek_client_list_vehicle_health(p_vehicle_id uuid)
returns setof public.vehicle_component_events
language sql security definer set search_path=public stable
as $$
  select distinct on (e.component_key) e.*
  from public.vehicle_component_events e
  join public.vehicles v on v.id=e.vehicle_id
  where e.vehicle_id=p_vehicle_id and v.owner_id=auth.uid()
  order by e.component_key, e.inspected_at desc, e.created_at desc;
$$;

grant execute on function public.dtek_client_list_vehicle_health(uuid) to authenticated;

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

  return query
  insert into public.vehicle_component_events(
    vehicle_id,appointment_id,work_order_id,component_key,status,source,
    notes,measured_value,mileage,inspected_at,created_by
  )
  select v_vehicle,p_appointment_id,v_order,
    trim(x->>'component_key'),coalesce(nullif(x->>'status',''),'unknown'),'dtek',
    nullif(trim(x->>'notes'),''),nullif(trim(x->>'measured_value'),''),
    v_mileage,now(),auth.uid()
  from jsonb_array_elements(coalesce(p_inspections,'[]'::jsonb)) x
  where trim(coalesce(x->>'component_key','')) <> ''
    and coalesce(x->>'status','') in ('ok','monitor','attention','unknown')
  on conflict (work_order_id,component_key) where work_order_id is not null
  do update set status=excluded.status,notes=excluded.notes,
    measured_value=excluded.measured_value,mileage=excluded.mileage,
    inspected_at=excluded.inspected_at,created_by=excluded.created_by
  returning *;
end;
$$;

grant execute on function public.dtek_admin_save_vehicle_inspections(uuid,jsonb) to authenticated;

-- Servicios que reinician automáticamente un control de mantenimiento.
create or replace function public.dtek_componentes_por_servicio(p_service text)
returns text[] language sql immutable as $$
  select case
    when p_service in ('servicio-menor-full','servicio-menor-plus','mantenimiento-express-mo')
      then array['engine_oil','engine_air_filter']
    when p_service='cambio-candelas-bujias' then array['spark_plugs']
    when p_service in ('cambio-radiador','cambio-termostato','cambio-bomba-agua')
      then array['coolant']
    when p_service='cambio-balatas-delanteras' then array['front_brakes']
    when p_service='cambio-balatas-traseras' then array['rear_brakes']
    when p_service='cambio-alternador' then array['battery']
    when p_service in ('cambio-amortiguadores','cambio-bujes-suspension','cambio-rotulas')
      then array['suspension']
    when p_service in ('cambio-terminales-direccion','cambio-bomba-direccion-hidraulica')
      then array['steering']
    else array[]::text[]
  end;
$$;

create or replace function public.dtek_registrar_componentes_servicio()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_vehicle uuid; v_appointment uuid; v_service text; v_mileage int; v_key text;
begin
  if new.status <> 'completed' then return new; end if;
  select a.id,a.vehicle_id,a.service_id,coalesce(new.mileage_at_service,v.mileage)
    into v_appointment,v_vehicle,v_service,v_mileage
  from public.appointments a left join public.vehicles v on v.id=a.vehicle_id
  where a.id=new.appointment_id;
  if v_vehicle is null then return new; end if;
  foreach v_key in array public.dtek_componentes_por_servicio(v_service) loop
    insert into public.vehicle_component_events(
      vehicle_id,appointment_id,work_order_id,component_key,status,source,
      notes,mileage,inspected_at,created_by
    ) values (
      v_vehicle,v_appointment,new.id,v_key,'serviced','automatic',
      'Actualizado automáticamente al cerrar el servicio.',v_mileage,
      coalesce(new.service_date::timestamptz,now()),auth.uid()
    )
    on conflict (work_order_id,component_key) where work_order_id is not null
    do update set status='serviced',source='automatic',mileage=excluded.mileage,
      inspected_at=excluded.inspected_at;
  end loop;
  return new;
end;
$$;

drop trigger if exists dtek_work_order_componentes on public.work_orders;
create trigger dtek_work_order_componentes
after insert or update of status on public.work_orders
for each row execute function public.dtek_registrar_componentes_servicio();

-- Carga retroactiva: registra los servicios completados que ya existen.
insert into public.vehicle_component_events(
  vehicle_id,appointment_id,work_order_id,component_key,status,source,notes,
  mileage,inspected_at
)
select a.vehicle_id,a.id,w.id,k,'serviced','automatic',
  'Importado desde el historial de servicios.',
  coalesce(w.mileage_at_service,v.mileage),
  coalesce(w.service_date::timestamptz,a.scheduled_start,w.created_at)
from public.work_orders w
join public.appointments a on a.id=w.appointment_id
join public.vehicles v on v.id=a.vehicle_id
cross join lateral unnest(public.dtek_componentes_por_servicio(a.service_id)) k
where w.status='completed'
on conflict (work_order_id,component_key) where work_order_id is not null do nothing;
