-- =====================================================================
-- D-TEK GT · Crear cita en vivo — 31 ago 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- El problema inverso al de 25_registro_trabajo_recurrente.sql: la
-- mayoría de citas reales nacen de una conversación de WhatsApp, no de
-- agenda.html. Hoy, para usar el reporte en vivo (checklist + fotos +
-- dictado, openWorkOrderModal/submitWorkOrderReport) hace falta que YA
-- exista una fila en appointments. Si el trabajo nunca pasó por
-- agenda.html ni por el panel, no hay cita a la cual abrirle el reporte.
--
-- Esto agrega la función que crea SOLO la cita (sin work_order, status
-- abierto) para que Dominic pueda abrir el reporte en vivo y llenarlo
-- mientras trabaja — más dos correcciones que aparecieron al trazar el
-- camino completo hasta el final (secciones 1 y 2 abajo).
--
-- No borra ni cambia nada de lo que ya existe.
-- Se corre una vez, en Supabase → SQL Editor, de una sola pasada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Correo opcional en appointments — salvaguarda idempotente
--
--    Esto YA se aplicó en 16_v30_3_2_booking_catalog_fix.sql (línea 43).
--    Se repite acá solo por seguridad: si por algún motivo esa migración
--    no llegó a correr en este proyecto de Supabase, esta línea lo deja
--    igual de bien. Si ya está aplicada, "drop not null" sobre una
--    columna que ya es nullable no hace nada y no falla.
-- ---------------------------------------------------------------------
alter table public.appointments
  alter column client_email drop not null;


-- ---------------------------------------------------------------------
-- 1. dtek_create_public_appointment — correo pasa de obligatorio a
--    opcional (agenda.html, paso 4)
--
--    Único cambio real: la validación "raise exception 'Correo
--    requerido'" se reemplaza por una que solo revisa el FORMATO si se
--    mandó algo. El resto es copia exacta de 03_scheduler_rpc.sql:47-144
--    — no se tocó la revisión de choque de horario ni ninguna otra línea.
-- ---------------------------------------------------------------------
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
declare
  v_email text := nullif(lower(trim(coalesce(p_client_email, ''))), '');
begin
  if p_service_id is null or not exists (select 1 from public.services where id = p_service_id and active = true) then
    raise exception 'Servicio inválido o inactivo';
  end if;

  if p_client_name is null or length(trim(p_client_name)) < 2 then
    raise exception 'Nombre requerido';
  end if;

  if v_email is not null and position('@' in v_email) < 2 then
    raise exception 'Correo inválido';
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
    v_email,
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


-- ---------------------------------------------------------------------
-- 2. vehicle_component_events.vehicle_id pasa a nullable
--
--    Sin esto, cualquier cita sin fila real en "vehicles" (invitado, o
--    "otro vehículo a mano") no puede guardar checklist ni fotos — justo
--    los dos casos que la función de "crear cita en vivo" tiene que
--    soportar.
--
--    No se toca ninguna otra columna ni política; el resto de la tabla
--    sigue igual.
-- ---------------------------------------------------------------------
alter table public.vehicle_component_events
  alter column vehicle_id drop not null;

-- Copia exacta de la versión vigente (24_reporte_vivo_taller.sql), con
-- un único cambio: ya no exige appointments.vehicle_id, solo que la
-- cita exista. v_vehicle puede quedar null — la columna ya lo admite.
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
-- 3. dtek_admin_create_live_appointment — la función nueva
--
--    Crea SOLO la fila de appointments (ningún work_order todavía).
--    status='confirmed': la crea Dominic a propósito, sabiendo que va a
--    trabajar en el momento — no tiene sentido que quede en 'requested'
--    esperando que él mismo la confirme.
--
--    Soporta:
--    - cliente existente: p_client_id (+ p_vehicle_id opcional, uno de
--      los suyos ya guardados)
--    - invitado: p_client_id null, con p_client_name/p_client_phone y
--      vehículo a mano (p_vehicle_brand/line/year)
--
--    service_id siempre null; la descripción libre va en service_label
--    (columna agregada en 25_registro_trabajo_recurrente.sql) —
--    appointments_view ya la muestra como service_name sin tocar nada.
--
--    Hora: p_scheduled_start la manda el panel, precargada con "ahora"
--    pero editable; coalesce(...,now()) es solo el respaldo si llegara
--    null. Duración por defecto 60 min, mínimo 15. Bloqueo con margen de
--    15 min antes/después, igual que dtek_admin_log_completed_job.
--
--    SIN revisión de choque de horario, a propósito: Dominic la crea
--    sabiendo su propio momento — mismo criterio que la función hermana.
--
--    Devuelve appointments_view (no appointments cruda): así trae
--    service_name/vehicle_summary ya calculados, listos para empujar
--    directo a dtekAdminAppointmentsCache sin ida y vuelta al servidor.
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_create_live_appointment(
  p_client_id uuid default null,
  p_vehicle_id uuid default null,
  p_client_name text default null,
  p_client_phone text default null,
  p_vehicle_brand text default null,
  p_vehicle_line text default null,
  p_vehicle_year int default null,
  p_service_label text default null,
  p_symptom text default null,
  p_scheduled_start timestamptz default null,
  p_duration_minutes int default 60
)
returns public.appointments_view
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.profiles;
  v_vehicle public.vehicles;
  v_id uuid;
  v_result public.appointments_view;
  v_name text;
  v_email text;
  v_phone text;
  v_brand text;
  v_line text;
  v_year int;
  v_desc text;
  v_start timestamptz;
  v_end timestamptz;
  v_minutos int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear una cita en vivo.';
  end if;

  -- Cliente: uno ya existente, o invitado con datos a mano.
  if p_client_id is not null then
    select * into v_client from public.profiles where id = p_client_id;
    if v_client.id is null then
      raise exception 'El cliente no existe.';
    end if;
    v_name  := coalesce(v_client.full_name, 'Cliente D-TEK');
    -- Solo el correo de contacto real, nunca el sintético que usa el
    -- login por usuario (@login.dtekgt.com) — acá el correo es
    -- opcional, no hace falta forzar uno que no sirve para contactar.
    v_email := nullif(trim(coalesce(v_client.contact_email, '')), '');
    v_phone := coalesce(nullif(trim(coalesce(p_client_phone, '')), ''), v_client.phone);
  else
    v_name := nullif(trim(coalesce(p_client_name, '')), '');
    if v_name is null or length(v_name) < 2 then
      raise exception 'Nombre del cliente requerido.';
    end if;
    v_email := null;
    v_phone := nullif(trim(coalesce(p_client_phone, '')), '');
  end if;

  -- Vehículo: uno guardado del cliente, o a mano.
  if p_vehicle_id is not null then
    if p_client_id is null then
      raise exception 'No se puede vincular un vehículo guardado sin un cliente existente.';
    end if;
    select * into v_vehicle from public.vehicles where id = p_vehicle_id and owner_id = p_client_id;
    if v_vehicle.id is null then
      raise exception 'Ese vehículo no pertenece a este cliente.';
    end if;
    v_brand := v_vehicle.brand;
    v_line  := v_vehicle.line;
    v_year  := v_vehicle.year;
  else
    v_brand := nullif(trim(coalesce(p_vehicle_brand, '')), '');
    v_line  := nullif(trim(coalesce(p_vehicle_line, '')), '');
    v_year  := p_vehicle_year;
    if v_brand is null or v_line is null then
      raise exception 'Indicá marca y línea del vehículo.';
    end if;
  end if;

  v_desc := nullif(trim(coalesce(p_service_label, '')), '');
  v_minutos := greatest(coalesce(p_duration_minutes, 60), 15);
  v_start := coalesce(p_scheduled_start, now());
  v_end   := v_start + make_interval(mins => v_minutos);

  insert into public.appointments (
    client_id, vehicle_id, service_id, service_label,
    client_name, client_email, client_phone,
    vehicle_brand, vehicle_line, vehicle_year,
    symptom,
    scheduled_start, scheduled_end, block_start, block_end,
    status, source
  ) values (
    p_client_id, p_vehicle_id, null, v_desc,
    v_name, v_email, v_phone,
    v_brand, v_line, v_year,
    nullif(trim(coalesce(p_symptom, '')), ''),
    v_start, v_end, v_start - interval '15 minutes', v_end + interval '15 minutes',
    'confirmed', 'admin-live'
  )
  returning id into v_id;

  select * into v_result from public.appointments_view where id = v_id;
  return v_result;
end;
$$;

grant execute on function public.dtek_admin_create_live_appointment(
  uuid, uuid, text, text, text, text, int, text, text, timestamptz, int
) to authenticated;
