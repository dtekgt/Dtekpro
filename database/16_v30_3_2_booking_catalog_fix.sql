-- D-TEK GT Web OS v30.3.3 — catálogo completo + agenda de perfiles sin correo
-- Ejecutar después de database/15_v30_3_1_admin_username.sql.
-- Corrige solicitudes fallidas en “Otros” y sincroniza todos los servicios del frontend con Supabase.

insert into public.services (
  id, name, category, price_from, duration_minutes, buffer_before, buffer_after,
  requires_approval, active, description
) values
('revision-express', 'Revisión Express', 'Revisión y diagnóstico', 'Desde Q250', 45, 15, 30, false, true, 'Una revisión rápida para ordenar el caso, detectar señales evidentes y decidir el siguiente paso sin perder tiempo.'),
('check-engine-escaneo-explicado', 'Check Engine / escaneo explicado', 'Revisión y diagnóstico', 'Desde Q250', 45, 15, 30, false, true, 'Lectura de códigos y explicación sencilla de lo que significan para evitar conclusiones apresuradas.'),
('escaneo-datos-vivo', 'Escaneo + datos en vivo', 'Revisión y diagnóstico', 'Desde Q300', 60, 30, 30, false, true, 'Revisión de datos en vivo para observar sensores y comportamiento real del vehículo según el síntoma.'),
('compra-segura', 'Compra Segura', 'Compra Segura', 'Desde Q450', 90, 30, 45, false, true, 'Revisión básica antes de pagar por un carro usado para detectar señales de alerta y comprar con más claridad.'),
('compra-segura-avanzada', 'Compra Segura Avanzada', 'Compra Segura', 'Desde Q850', 150, 45, 60, true, true, 'Revisión pre-compra más profunda para vehículos donde necesitás más certeza antes de cerrar el negocio.'),
('diagnostico-pro', 'Diagnóstico Pro', 'Revisión y diagnóstico', 'Desde Q550', 120, 30, 45, true, true, 'Diagnóstico con criterio técnico antes de cambiar piezas, ideal para fallas que no se resuelven solo leyendo códigos.'),
('aprendizajes-calibraciones-simples', 'Aprendizajes / calibraciones simples', 'Revisión y diagnóstico', 'Desde Q300', 60, 15, 30, true, true, 'Procedimientos de aprendizaje, adaptación o calibración cuando el vehículo y el escáner lo permiten.'),
('reset-mantenimiento-servicio', 'Reset mantenimiento / servicio', 'Mantenimiento', 'Desde Q150', 30, 15, 15, false, true, 'Reinicio de aviso de mantenimiento o servicio cuando el sistema del vehículo lo permite. No incluye diagnóstico ni reparación.'),
('mantenimiento-express-mo', 'Mantenimiento Express MO', 'Mantenimiento', 'Desde Q250 MO', 75, 30, 30, false, true, 'Mano de obra para cambio de aceite cuando el cliente ya tiene los insumos correctos.'),
('servicio-menor-full', 'Servicio Menor Full', 'Mantenimiento', 'Desde Q650', 90, 30, 30, false, true, 'Aceite + filtro + mano de obra a domicilio, con materiales incluidos según vehículo y disponibilidad.'),
('servicio-menor-plus', 'Servicio Menor Plus', 'Mantenimiento', 'Desde Q850', 105, 30, 30, false, true, 'Servicio menor con aceite, filtro de aceite, mano de obra y filtro de aire incluido según vehículo.'),
('cambio-candelas-bujias', 'Cambio de candelas / bujías', 'Mantenimiento', 'Según vehículo', 90, 30, 30, false, true, 'Cambio de candelas/bujías según vehículo. Si hay falla activa, se recomienda escaneo o diagnóstico para evitar cambiar piezas a ciegas.'),
('filtro-cabina-instalado', 'Filtro de cabina instalado', 'Mantenimiento', 'Desde Q175', 40, 15, 15, false, true, 'Instalación de filtro de cabina según acceso y modelo del vehículo.'),
('servicio-frenos-recomendado', 'Servicio de Frenos Recomendado', 'Frenos', 'Desde Q1,050 por eje', 150, 45, 60, true, true, 'Servicio recomendado por eje con pastillas y mantenimiento de calipers, sujeto a vehículo y repuestos.'),
('inyeccion-admision-consulta', 'Inyección y admisión', 'Inyección y admisión', 'Según evaluación', 90, 30, 45, true, true, 'Categoría preparada para servicios de limpieza o revisión de admisión e inyección según el tipo de motor.'),
('limpieza-cuerpo-aceleracion', 'Limpieza de cuerpo de aceleración', 'Inyección y admisión', 'Según vehículo', 75, 30, 30, false, true, 'Limpieza de cuerpo de aceleración cuando aplica según vehículo, acceso y síntoma. Si hay falla activa se recomienda diagnóstico previo.'),
('limpieza-admision', 'Limpieza de admisión', 'Inyección y admisión', 'Según vehículo', 120, 30, 45, false, true, 'Limpieza o mantenimiento de admisión según vehículo, tipo de motor, acceso y nivel de suciedad.'),
('limpieza-inyectores-gasolina', 'Limpieza de inyectores gasolina', 'Inyección y admisión', 'Según vehículo', 120, 30, 45, false, true, 'Servicio de inyectores a gasolina sujeto a tipo de inyección, acceso, empaques y condición del vehículo.'),
('tpms-electrico-bateria', 'TPMS, eléctrico y batería', 'TPMS, eléctrico y batería', 'Según evaluación', 75, 30, 30, false, true, 'Revisión inicial para fallas de sensores, batería, carga o luces relacionadas al sistema eléctrico.'),
('ac-suspension-varios', 'A/C, suspensión y varios', 'A/C, suspensión y varios', 'Según evaluación', 90, 30, 45, true, true, 'Categoría para servicios que requieren confirmar síntoma, vehículo, acceso y condiciones antes de definir el alcance.'),
('otros-servicios', 'Otros / no aparece en la lista', 'Otros', 'Cotización personalizada', 90, 30, 45, true, true, 'Salida abierta para cualquier reparación, mantenimiento o clavo que no aparezca en el catálogo. D-TEK confirma alcance, repuestos, tiempo y precio antes de realizarlo.')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price_from = excluded.price_from,
  duration_minutes = excluded.duration_minutes,
  buffer_before = excluded.buffer_before,
  buffer_after = excluded.buffer_after,
  requires_approval = excluded.requires_approval,
  active = true,
  description = excluded.description,
  updated_at = now();

-- El correo de contacto es opcional para perfiles que entran únicamente con usuario.
alter table public.appointments alter column client_email drop not null;

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
  v_email text := nullif(lower(trim(coalesce(p_client_email, ''))), '');
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

  if p_service_id is null or not exists (
    select 1 from public.services where id = p_service_id and active = true
  ) then
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
    client_id, vehicle_id, service_id, client_name, client_email, client_phone,
    vehicle_brand, vehicle_line, vehicle_year, vehicle_moves, location, city, symptom,
    scheduled_start, scheduled_end, block_start, block_end, status, source
  ) values (
    auth.uid(), v_vehicle.id, p_service_id, trim(p_client_name), v_email,
    nullif(trim(coalesce(p_client_phone, '')), ''),
    v_vehicle.brand, v_vehicle.line, v_vehicle.year,
    nullif(trim(coalesce(p_vehicle_moves, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_symptom, '')), ''),
    p_scheduled_start, p_scheduled_end, p_block_start, p_block_end,
    'requested', coalesce(nullif(trim(p_source), ''), 'client-portal-vehicle')
  )
  returning *;
end;
$$;

grant execute on function public.dtek_client_create_appointment_for_vehicle(
  uuid, text, text, text, text, text, text, text, text,
  timestamptz, timestamptz, timestamptz, timestamptz, text
) to authenticated;

-- Comprobación rápida: debe devolver 21 servicios activos.
select count(*) as active_catalog_services
from public.services
where active = true
  and id in ('revision-express', 'check-engine-escaneo-explicado', 'escaneo-datos-vivo', 'compra-segura', 'compra-segura-avanzada', 'diagnostico-pro', 'aprendizajes-calibraciones-simples', 'reset-mantenimiento-servicio', 'mantenimiento-express-mo', 'servicio-menor-full', 'servicio-menor-plus', 'cambio-candelas-bujias', 'filtro-cabina-instalado', 'servicio-frenos-recomendado', 'inyeccion-admision-consulta', 'limpieza-cuerpo-aceleracion', 'limpieza-admision', 'limpieza-inyectores-gasolina', 'tpms-electrico-bateria', 'ac-suspension-varios', 'otros-servicios');
