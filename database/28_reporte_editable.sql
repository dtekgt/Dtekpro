-- =====================================================================
-- D-TEK GT · v41 — El reporte técnico se puede volver a abrir y editar
-- Correr UNA VEZ en Supabase → SQL Editor, después de la 27.
-- No borra datos.
-- =====================================================================
--
-- Tres cosas que hoy no funcionan:
--
-- 1. EL INTERVALO NO SE GUARDA (bug de regresión).
--    La 21 agregó las columnas interval_months / interval_km y su versión
--    de dtek_admin_save_vehicle_inspections las escribía. La 24 volvió a
--    crear esa función para sumarle foto/voz/título y, al reescribirla,
--    dejó fuera interval_months, interval_km y plan_*. La 26 copió la
--    versión de la 24 tal cual. Resultado: desde la 24, el panel manda
--    interval_months/interval_km (backend-admin.js:724-725) y la función
--    los descarta en silencio, mientras vehicle-health.js:111-112 los lee
--    esperando encontrarlos. Por eso "cada cuántos km toca el próximo
--    servicio" se puede escribir pero nunca queda guardado.
--
-- 2. FECHA Y KM DEL SERVICIO NO TIENEN DÓNDE CAER.
--    El panel manda service_date y service_mileage desde la 21, pero esas
--    columnas nunca se crearon en ninguna migración. Se pierden siempre.
--
-- 3. NO HAY DÓNDE ANOTAR CÓDIGOS DE FALLA.
--    "Escaneo OBD-II" aparece en el catálogo de servicios, pero no existe
--    ninguna columna para guardar los códigos leídos. Hoy solo caben como
--    texto suelto dentro de una nota.
--
-- Lo que NO se toca: dtek_admin_cerrar_trabajo se deja igual. Los códigos
-- de falla entran por su propia función chica en vez de recrear una que ya
-- está en producción y funciona.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.vehicle_component_events
  add column if not exists service_date date,
  add column if not exists service_mileage int;

alter table public.work_orders
  add column if not exists fault_codes jsonb not null default '[]'::jsonb;

comment on column public.vehicle_component_events.service_date is
  'Fecha real en que se hizo ese mantenimiento, si no fue la de la cita.';
comment on column public.vehicle_component_events.service_mileage is
  'Kilometraje real de ese mantenimiento, si no fue el del cierre.';
comment on column public.work_orders.fault_codes is
  'Códigos OBD leídos, anclados al km igual que el trabajo: '
  '[{"code":"P0301","description":"Falla cilindro 1","mileage":87500,"read_at":"2026-09-04T10:00:00Z"}]';


-- ---------------------------------------------------------------------
-- 2. dtek_admin_save_vehicle_inspections — vuelve a guardar el intervalo
--
--    Base: la versión vigente de la 26 (que ya no exige vehicle_id).
--    Cambio: se reincorporan interval_months, interval_km y plan_*, que la
--    24 había perdido, y se agregan service_date / service_mileage.
--
--    Los coalesce del UPDATE son a propósito: si el panel manda null en un
--    intervalo (porque el campo quedó vacío), se conserva el que ya estaba
--    en vez de borrarlo. Un campo vacío significa "no lo toqué", no
--    "borrámelo".
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

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'La cita no existe.';
  end if;

  select a.vehicle_id,w.id,coalesce(w.mileage_at_service,v.mileage)
    into v_vehicle,v_order,v_mileage
  from public.appointments a
  left join public.work_orders w on w.appointment_id=a.id
  left join public.vehicles v on v.id=a.vehicle_id
  where a.id=p_appointment_id;

  return query
  insert into public.vehicle_component_events(
    vehicle_id,appointment_id,work_order_id,component_key,component_label,status,source,
    notes,measured_value,mileage,inspected_at,created_by,photo_paths,comment_source,
    interval_months,interval_km,service_date,service_mileage
  )
  select v_vehicle,p_appointment_id,v_order,
    trim(x->>'component_key'),
    nullif(trim(x->>'component_label'),''),
    coalesce(nullif(x->>'status',''),'unknown'),'dtek',
    nullif(trim(x->>'notes'),''),nullif(trim(x->>'measured_value'),''),
    v_mileage,now(),auth.uid(),
    coalesce(x->'photo_paths','[]'::jsonb),
    nullif(x->>'comment_source',''),
    nullif(x->>'interval_months','')::int,
    nullif(x->>'interval_km','')::int,
    nullif(x->>'service_date','')::date,
    nullif(x->>'service_mileage','')::int
  from jsonb_array_elements(coalesce(p_inspections,'[]'::jsonb)) x
  where trim(coalesce(x->>'component_key','')) <> ''
    and coalesce(x->>'status','') in ('ok','monitor','attention','serviced','unknown')
  on conflict (work_order_id,component_key) where work_order_id is not null
  do update set status=excluded.status,notes=excluded.notes,
    measured_value=excluded.measured_value,mileage=excluded.mileage,
    inspected_at=excluded.inspected_at,created_by=excluded.created_by,
    photo_paths=excluded.photo_paths,comment_source=excluded.comment_source,
    component_label=excluded.component_label,
    interval_months=coalesce(excluded.interval_months,vehicle_component_events.interval_months),
    interval_km=coalesce(excluded.interval_km,vehicle_component_events.interval_km),
    service_date=coalesce(excluded.service_date,vehicle_component_events.service_date),
    service_mileage=coalesce(excluded.service_mileage,vehicle_component_events.service_mileage)
  returning *;
end;
$$;

grant execute on function public.dtek_admin_save_vehicle_inspections(uuid,jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Borrar una revisión ya guardada
--
--    Hasta ahora una fila solo se podía sobrescribir, nunca quitar. Si se
--    marcó por error "Frenos traseros: requiere atención", esa alarma le
--    quedaba al cliente en su Garage para siempre.
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_delete_inspection(
  p_appointment_id uuid,
  p_component_key text
)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Solo un administrador puede borrar una revisión.';
  end if;

  delete from public.vehicle_component_events
   where appointment_id = p_appointment_id
     and component_key = p_component_key;
end;
$$;

grant execute on function public.dtek_admin_delete_inspection(uuid,text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Códigos de falla de la visita, anclados al kilometraje
--
--    Función aparte para no recrear dtek_admin_cerrar_trabajo, que ya está
--    en producción. Se guarda la lista entera de una vez: es como sale del
--    escáner, y así borrar un código es mandar la lista sin él.
--
--    El anclaje al km funciona igual que en las revisiones: el código se
--    queda con el kilometraje que tenía el carro cuando se leyó. Un código
--    que YA trae mileage conserva el suyo — así, si dentro de un año se
--    reabre este reporte para agregar otro código, los viejos no se
--    remarcan con el kilometraje de hoy. Sin esto, editar el reporte
--    reescribiría la historia.
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_save_fault_codes(
  p_appointment_id uuid,
  p_codes jsonb default '[]'::jsonb
)
returns public.work_orders
language plpgsql security definer set search_path=public
as $$
declare
  v_orden public.work_orders;
  v_km int;
  v_codes jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Solo un administrador puede guardar códigos de falla.';
  end if;

  select coalesce(w.mileage_at_service, v.mileage)
    into v_km
  from public.appointments a
  left join public.work_orders w on w.appointment_id = a.id
  left join public.vehicles v on v.id = a.vehicle_id
  where a.id = p_appointment_id;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'code',        upper(trim(x->>'code')),
             'description', nullif(trim(x->>'description'),''),
             -- el que ya venía anclado conserva su km; el nuevo toma el de hoy
             'mileage',     coalesce(nullif(x->>'mileage','')::int, v_km),
             'read_at',     coalesce(nullif(x->>'read_at',''), to_char(now(),'YYYY-MM-DD"T"HH24:MI:SSOF'))
           )
           order by ordinalidad
         ), '[]'::jsonb)
    into v_codes
  from jsonb_array_elements(coalesce(p_codes,'[]'::jsonb)) with ordinality as t(x, ordinalidad)
  where nullif(trim(x->>'code'),'') is not null;

  update public.work_orders
     set fault_codes = v_codes,
         updated_at  = now()
   where appointment_id = p_appointment_id
  returning * into v_orden;

  if v_orden.id is null then
    raise exception 'Esa cita todavía no tiene un trabajo registrado.';
  end if;

  return v_orden;
end;
$$;

grant execute on function public.dtek_admin_save_fault_codes(uuid,jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Leer los códigos guardados (admin y el dueño del carro)
-- ---------------------------------------------------------------------
create or replace function public.dtek_fault_codes(p_appointment_id uuid)
returns jsonb
language sql security definer set search_path=public stable
as $$
  select coalesce(w.fault_codes,'[]'::jsonb)
  from public.appointments a
  join public.work_orders w on w.appointment_id = a.id
  where a.id = p_appointment_id
    and (
      a.client_id = auth.uid()
      or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
    );
$$;

grant execute on function public.dtek_fault_codes(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Comprobación después de correr todo
-- ---------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_name='vehicle_component_events'
--    and column_name in ('interval_months','interval_km','service_date','service_mileage');
--   -> deben salir las 4
--
-- select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc
--  where proname in ('dtek_admin_save_vehicle_inspections','dtek_admin_delete_inspection',
--                    'dtek_admin_save_fault_codes','dtek_fault_codes');
--   -> una fila por función, ninguna duplicada
