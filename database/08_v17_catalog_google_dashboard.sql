-- D-TEK GT Web OS v17 — catálogo + portal/dashboard
-- Ejecutar después de 01–07 si querés sincronizar Supabase con el catálogo maestro.

insert into public.services (
  id,
  name,
  category,
  price_from,
  duration_minutes,
  buffer_before,
  buffer_after,
  requires_approval,
  active,
  description
) values (
  'cambio-candelas-bujias',
  'Cambio de candelas / bujías',
  'Mantenimiento',
  'Según vehículo',
  90,
  30,
  30,
  false,
  true,
  'Cambio de candelas/bujías según vehículo. Si hay falla activa, se recomienda escaneo o diagnóstico para evitar cambiar piezas a ciegas.'
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

update public.services
set category = 'Compra Segura'
where id in ('compra-segura', 'compra-segura-avanzada');
