-- =====================================================================
-- D-TEK GT · Duración real y ubicación en trabajos/citas de admin — 31 ago 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- El problema: dtek_admin_log_completed_job siempre grababa 60 minutos
-- fijos (v_end := v_start + interval '60 minutes') sin importar cuánto
-- duró el trabajo real, y hardcodeaba location = 'Registrado por D-TEK'
-- (un string, no una dirección). dtek_admin_create_live_appointment ya
-- tenía duración real (p_duration_minutes) pero ningún parámetro de
-- ubicación — la columna location ni aparecía en su INSERT. Resultado:
-- las citas que Dominic crea desde el panel (la mayoría, por WhatsApp)
-- no llevan dirección real y el timeline las muestra todas como si
-- hubieran durado exactamente una hora.
--
-- Esto agrega p_duration_minutes (nuevo) y p_location (nuevo) a AMBAS
-- funciones. Postgres identifica funciones por nombre + tipos de
-- parámetros: agregar parámetros sin dropear la firma vieja primero deja
-- las dos versiones coexistiendo como sobrecargas — mismo patrón que ya
-- se usó en 11_v21_vehicle_living_profile.sql (drop de la firma vieja,
-- create or replace con la firma nueva). Los parámetros nuevos van al
-- FINAL de la lista en ambas funciones.
--
-- No borra ni cambia nada más de lo que ya existe.
-- Se corre una vez, en Supabase → SQL Editor, de una sola pasada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. dtek_admin_log_completed_job — duración real + ubicación real
--
--    v_end ya no es siempre +60 minutos: usa el mismo patrón que
--    dtek_admin_create_live_appointment (greatest + make_interval,
--    mínimo 15 min). location ya no es el string fijo 'Registrado por
--    D-TEK': usa p_location, o null si no se especificó nada.
-- ---------------------------------------------------------------------
drop function if exists public.dtek_admin_log_completed_job(
  uuid, uuid, text, date, int, text, text, jsonb, text, text, int
);

create or replace function public.dtek_admin_log_completed_job(
  p_client_id uuid,
  p_vehicle_id uuid default null,
  p_job_description text default null,
  p_service_date date default null,
  p_mileage int default null,
  p_recommendations text default null,
  p_parts_notes text default null,
  p_items jsonb default '[]'::jsonb,
  p_vehicle_brand text default null,
  p_vehicle_line text default null,
  p_vehicle_year int default null,
  p_duration_minutes int default 60,
  p_location text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.profiles;
  v_vehicle public.vehicles;
  v_appointment public.appointments;
  v_orden public.work_orders;
  v_mano numeric := 0;
  v_partes numeric := 0;
  v_fecha date;
  v_desc text;
  v_email text;
  v_brand text;
  v_line text;
  v_year int;
  v_start timestamptz;
  v_end timestamptz;
  v_minutos int;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede registrar un trabajo.';
  end if;

  select * into v_client from public.profiles where id = p_client_id;
  if v_client.id is null then
    raise exception 'El cliente no existe.';
  end if;

  v_email := coalesce(v_client.email, v_client.contact_email);
  if v_email is null then
    raise exception 'El cliente no tiene correo registrado; no se puede continuar.';
  end if;

  v_desc := nullif(trim(coalesce(p_job_description, '')), '');
  if v_desc is null then
    raise exception 'Describí qué trabajo se hizo.';
  end if;

  -- El vehículo: o es uno ya guardado del cliente, o se escribe a mano
  -- (cliente sin ningún carro registrado todavía).
  if p_vehicle_id is not null then
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
      raise exception 'Indicá marca y línea del vehículo si el cliente no tiene uno registrado.';
    end if;
  end if;

  v_fecha := coalesce(p_service_date, current_date);
  v_start := (v_fecha::timestamp + time '12:00:00') at time zone 'America/Guatemala';
  v_minutos := greatest(coalesce(p_duration_minutes, 60), 15);
  v_end   := v_start + make_interval(mins => v_minutos);

  insert into public.appointments (
    client_id, vehicle_id, service_id, service_label,
    client_name, client_email, client_phone,
    vehicle_brand, vehicle_line, vehicle_year, vehicle_moves,
    location, city, symptom,
    scheduled_start, scheduled_end, block_start, block_end,
    status, source
  ) values (
    p_client_id, p_vehicle_id, null, v_desc,
    coalesce(v_client.full_name, 'Cliente D-TEK'), v_email, v_client.phone,
    v_brand, v_line, v_year, 'Sí, arranca y se mueve',
    nullif(trim(coalesce(p_location, '')), ''), null, v_desc,
    v_start, v_end, v_start - interval '15 minutes', v_end + interval '15 minutes',
    'completed', 'admin-walkin'
  )
  returning * into v_appointment;

  insert into public.work_orders (
    appointment_id, diagnosis, recommendations, parts_notes,
    labor_total, parts_total, grand_total, status,
    mileage_at_service, service_date
  ) values (
    v_appointment.id, v_desc, p_recommendations, p_parts_notes,
    0, 0, 0, 'completed',
    p_mileage, v_fecha
  )
  returning * into v_orden;

  insert into public.work_order_items (work_order_id, description, kind, quantity, unit_price, service_id, position)
  select
    v_orden.id,
    nullif(trim(item->>'description'), ''),
    coalesce(nullif(item->>'kind', ''), 'part'),
    coalesce((item->>'quantity')::numeric, 1),
    coalesce((item->>'unit_price')::numeric, 0),
    nullif(item->>'service_id', ''),
    coalesce((item->>'position')::int, ordinalidad::int)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(item, ordinalidad)
  where nullif(trim(item->>'description'), '') is not null;

  select
    coalesce(sum(subtotal) filter (where kind = 'labor'), 0),
    coalesce(sum(subtotal) filter (where kind <> 'labor'), 0)
  into v_mano, v_partes
  from public.work_order_items
  where work_order_id = v_orden.id;

  update public.work_orders
     set labor_total = v_mano,
         parts_total = v_partes,
         grand_total = v_mano + v_partes,
         updated_at  = now()
   where id = v_orden.id
  returning * into v_orden;

  if p_mileage is not null and p_vehicle_id is not null then
    update public.vehicles
       set mileage = p_mileage, updated_at = now()
     where id = p_vehicle_id
       and (mileage is null or mileage < p_mileage);
  end if;

  return v_orden;
end;
$$;

grant execute on function public.dtek_admin_log_completed_job(
  uuid, uuid, text, date, int, text, text, jsonb, text, text, int, int, text
) to authenticated;


-- ---------------------------------------------------------------------
-- 2. dtek_admin_create_live_appointment — ubicación real
--
--    Único cambio real: se agrega p_location al final y se escribe en
--    el INSERT (antes la columna location ni aparecía). Duración ya
--    estaba bien resuelta acá desde 26_crear_cita_en_vivo.sql, no se
--    toca esa parte.
-- ---------------------------------------------------------------------
drop function if exists public.dtek_admin_create_live_appointment(
  uuid, uuid, text, text, text, text, int, text, text, timestamptz, int
);

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
  p_duration_minutes int default 60,
  p_location text default null
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
    location, symptom,
    scheduled_start, scheduled_end, block_start, block_end,
    status, source
  ) values (
    p_client_id, p_vehicle_id, null, v_desc,
    v_name, v_email, v_phone,
    v_brand, v_line, v_year,
    nullif(trim(coalesce(p_location, '')), ''),
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
  uuid, uuid, text, text, text, text, int, text, text, timestamptz, int, text
) to authenticated;
