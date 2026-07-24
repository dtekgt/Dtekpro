-- D-TEK GT Web OS v19 — Servicios nuevos de inyección/admisión + pulido de catálogo
-- Ejecutar después de 01–08 si querés sincronizar Supabase con el catálogo maestro.

insert into public.services (
  id, name, category, price_from, duration_minutes, buffer_before, buffer_after,
  requires_approval, active, description
) values
(
  'limpieza-cuerpo-aceleracion',
  'Limpieza de cuerpo de aceleración',
  'Inyección y admisión',
  'Según vehículo',
  75, 30, 30,
  false,
  true,
  'Limpieza de cuerpo de aceleración cuando aplica según vehículo, acceso y síntoma. Si hay falla activa se recomienda diagnóstico previo.'
),
(
  'limpieza-admision',
  'Limpieza de admisión',
  'Inyección y admisión',
  'Según vehículo',
  120, 30, 45,
  false,
  true,
  'Limpieza o mantenimiento de admisión según vehículo, tipo de motor, acceso y nivel de suciedad.'
),
(
  'limpieza-inyectores-gasolina',
  'Limpieza de inyectores gasolina',
  'Inyección y admisión',
  'Según vehículo',
  120, 30, 45,
  false,
  true,
  'Servicio de inyectores a gasolina sujeto a tipo de inyección, acceso, empaques y condición del vehículo.'
)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price_from = excluded.price_from,
  duration_minutes = excluded.duration_minutes,
  buffer_before = excluded.buffer_before,
  buffer_after = excluded.buffer_after,
  requires_approval = excluded.requires_approval,
  active = excluded.active,
  description = excluded.description,
  updated_at = now();
