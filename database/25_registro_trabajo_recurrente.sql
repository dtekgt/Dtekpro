-- =====================================================================
-- D-TEK GT · Registrar trabajo ya realizado — 31 ago 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- El problema: un trabajo que se coordinó 100% por WhatsApp, con un
-- cliente que YA tiene cuenta, y que no está en el catálogo de servicios.
-- Hoy no hay forma de registrarlo — dtek_admin_cerrar_trabajo exige una
-- fila en appointments que nunca se creó, porque nunca pasó por agenda.html.
--
-- Esto agrega: una columna para describir el trabajo sin catálogo, una
-- búsqueda de cliente por teléfono para admin (con IDs reales, a
-- diferencia de dtek_lookup_by_phone que es pública y no los expone), y
-- una función que crea la cita retroactiva + el reporte + sus líneas en
-- un solo paso, atómico.
--
-- No borra ni cambia nada de lo que ya existe.
-- Se corre una vez, en Supabase → SQL Editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Descripción libre del trabajo, para cuando no hay service_id
--
--    appointments.service_id es nullable pero no había dónde escribir
--    QUÉ se hizo cuando no sale de catálogo. Sin esto, todo trabajo
--    fuera de catálogo se ve como "Servicio" genérico en todos lados.
-- ---------------------------------------------------------------------
alter table public.appointments
  add column if not exists service_label text;

-- No se puede usar "create or replace view" acá: al agregar service_label
-- a appointments, a.* corre esa columna nueva justo a la posición donde
-- antes estaba service_name, y Postgres interpreta eso como un intento de
-- renombrar una columna de la vista (error 42P16) en vez de agregar una.
-- Drop + create evita el chequeo posicional; no hay grants propios sobre
-- esta vista (los permisos de anon/authenticated son privilegios por
-- defecto del schema, se vuelven a aplicar solos a la vista recreada).
drop view if exists public.appointments_view;

create view public.appointments_view as
select
  a.*,
  coalesce(s.name, a.service_label) as service_name,
  s.category as service_category,
  s.price_from as service_price,
  concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text) as vehicle_summary
from public.appointments a
left join public.services s on s.id = a.service_id;


-- ---------------------------------------------------------------------
-- 2. Buscar cliente por teléfono, solo para admin, con IDs reales
--
--    dtek_lookup_by_phone (database/23) es pública (grant a anon) y por
--    diseño NO trae client_id ni vehicle_id — no se le pueden agregar acá
--    porque cualquiera sin sesión puede llamarla. Esta es nueva, exige
--    is_admin(), y sí trae los IDs porque hace falta vincular la cita a
--    un cliente y un vehículo reales, no solo autocompletar texto.
--
--    Reusa dtek_normalize_phone (ya existe desde database/23).
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_lookup_client_by_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_profile record;
  v_vehicles jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede buscar clientes.';
  end if;

  v_key := public.dtek_normalize_phone(p_phone);
  if v_key is null then
    return jsonb_build_object('found', false);
  end if;

  select p.id, p.full_name, p.phone, p.email
  into v_profile
  from public.profiles p
  where public.dtek_normalize_phone(p.phone) = v_key
  order by p.updated_at desc
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', veh.id,
    'brand', veh.brand,
    'line', veh.line,
    'year', veh.year,
    'plate', veh.plate,
    'mileage', veh.mileage,
    'nickname', veh.nickname
  ) order by veh.updated_at desc), '[]'::jsonb)
  into v_vehicles
  from public.vehicles veh
  where veh.owner_id = v_profile.id;

  return jsonb_build_object(
    'found', true,
    'client_id', v_profile.id,
    'name', v_profile.full_name,
    'phone', v_profile.phone,
    'email', v_profile.email,
    'vehicles', v_vehicles
  );
end;
$$;

grant execute on function public.dtek_admin_lookup_client_by_phone(text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Registrar un trabajo YA REALIZADO para un cliente existente
--
--    Crea la cita (retroactiva, status='completed', source='admin-walkin'
--    para diferenciarla en reportes de dónde vino), el reporte y sus
--    líneas, en un solo paso. Copia exactamente el patrón de
--    dtek_admin_cerrar_trabajo: inserta el work_order en cero, mete las
--    líneas, y RECIÉN AHÍ recalcula los totales desde el detalle — así
--    los triggers de puntos de lealtad (13_v27_points_rewards.sql) y de
--    componentes (20_estado_vehiculo.sql) se disparan solos, igual que
--    con cualquier otro trabajo cerrado. No hace falta tocarlos.
--
--    Solo sirve para un cliente que YA tiene perfil (profiles). Si el
--    teléfono no aparece en dtek_admin_lookup_client_by_phone, el cliente
--    se da de alta con "Crear acceso" primero — esa función ya crea
--    perfil + vehículo + primer servicio correctamente.
-- ---------------------------------------------------------------------
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
  p_vehicle_year int default null
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
  v_end   := v_start + interval '60 minutes';

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
    'Registrado por D-TEK', null, v_desc,
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
  uuid, uuid, text, date, int, text, text, jsonb, text, text, int
) to authenticated;
