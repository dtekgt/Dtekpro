-- =====================================================================
-- D-TEK GT · Reporte del Mecánico en Vivo — 30 ago 2026
-- Requiere 19_lineas_de_recibo.sql y 20_estado_vehiculo.sql ya aplicados.
-- No borra nada de lo que ya existe. Ejecutar UNA VEZ en Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bucket de Storage para fotos de inspección — privado, solo por
--    signed URL. Las fotos pueden mostrar placas, direcciones, garages:
--    mismo criterio de privacidad que el resto del RLS del proyecto.
--
--    Ruta de cada archivo: <vehicle_id>/<appointment_id>/<component_key>/<uuid>.jpg
--    Se usa appointment_id (no work_order_id) porque la fila de work_orders
--    recién existe al cerrar el trabajo — las fotos se toman antes.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-inspections', 'vehicle-inspections', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists vehicle_inspections_admin_all on storage.objects;
create policy vehicle_inspections_admin_all
  on storage.objects for all
  using (bucket_id = 'vehicle-inspections' and public.is_admin())
  with check (bucket_id = 'vehicle-inspections' and public.is_admin());

drop policy if exists vehicle_inspections_client_read on storage.objects;
create policy vehicle_inspections_client_read
  on storage.objects for select
  using (
    bucket_id = 'vehicle-inspections'
    and exists (
      select 1 from public.vehicles v
      where v.owner_id = auth.uid()
        and v.id = ((storage.foldername(name))[1])::uuid
    )
  );

-- ---------------------------------------------------------------------
-- 2. Columnas nuevas en vehicle_component_events
--    photo_paths: rutas de Storage (no URLs firmadas, esas se generan al vuelo)
--    comment_source: si la nota se escribió o se dictó por voz
--    component_label: título de las secciones ad-hoc ("Agregar sección"),
--      que no tienen nombre fijo en el catálogo de vehicle-health.js
-- ---------------------------------------------------------------------
alter table public.vehicle_component_events
  add column if not exists photo_paths jsonb not null default '[]'::jsonb,
  add column if not exists comment_source text check (comment_source in ('text','voice')),
  add column if not exists component_label text;

-- ---------------------------------------------------------------------
-- 3. dtek_admin_save_vehicle_inspections — acepta foto/voz/título nuevos
--    y corrige un bug ya existente: el filtro de estados permitidos no
--    incluía 'serviced', que es el valor real que manda el checklist al
--    marcar "Servicio realizado hoy" — hoy esa acción nunca se guardaba.
-- ---------------------------------------------------------------------
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
    vehicle_id,appointment_id,work_order_id,component_key,component_label,status,source,
    notes,measured_value,mileage,inspected_at,created_by,photo_paths,comment_source
  )
  select v_vehicle,p_appointment_id,v_order,
    trim(x->>'component_key'),
    nullif(trim(x->>'component_label'),''),
    coalesce(nullif(x->>'status',''),'unknown'),'dtek',
    nullif(trim(x->>'notes'),''),nullif(trim(x->>'measured_value'),''),
    v_mileage,now(),auth.uid(),
    coalesce(x->'photo_paths','[]'::jsonb),
    nullif(x->>'comment_source','')
  from jsonb_array_elements(coalesce(p_inspections,'[]'::jsonb)) x
  where trim(coalesce(x->>'component_key','')) <> ''
    and coalesce(x->>'status','') in ('ok','monitor','attention','serviced','unknown')
  on conflict (work_order_id,component_key) where work_order_id is not null
  do update set status=excluded.status,notes=excluded.notes,
    measured_value=excluded.measured_value,mileage=excluded.mileage,
    inspected_at=excluded.inspected_at,created_by=excluded.created_by,
    photo_paths=excluded.photo_paths,comment_source=excluded.comment_source,
    component_label=excluded.component_label
  returning *;
end;
$$;

grant execute on function public.dtek_admin_save_vehicle_inspections(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. dtek_client_work_order_inspections — lo que ve el cliente en el
--    expediente de UNA visita puntual (no dedupe: trae todos los ítems
--    tocados en esa cita, incluidas las secciones ad-hoc). La RPC
--    dtek_client_list_vehicle_health no sirve para esto porque dedupea
--    por component_key y no muestra hallazgos de una visita específica.
-- ---------------------------------------------------------------------
create or replace function public.dtek_client_work_order_inspections(
  p_appointment_id uuid
)
returns setof public.vehicle_component_events
language sql security definer set search_path=public stable
as $$
  select e.*
  from public.vehicle_component_events e
  join public.appointments a on a.id = e.appointment_id
  where a.id = p_appointment_id
    and (a.client_id = auth.uid() or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  order by e.created_at asc;
$$;

grant execute on function public.dtek_client_work_order_inspections(uuid) to authenticated;
