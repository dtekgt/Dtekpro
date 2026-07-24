-- D-TEK GT Web OS v9 — Seed de servicios iniciales
-- Correr después de 01_schema.sql

insert into public.services (id, name, category, price_from, duration_minutes, buffer_before, buffer_after, requires_approval, description)
values
('revision-express', 'Revisión Express', 'Agendables', 'Desde Q250', 45, 15, 30, false, 'Revisión inicial para saber por dónde empezar.'),
('check-engine-escaneo-explicado', 'Check Engine / escaneo explicado', 'Revisión y diagnóstico', 'Desde Q250', 45, 15, 30, false, 'Escaneo y explicación clara de códigos.'),
('escaneo-datos-vivo', 'Escaneo + datos en vivo', 'Revisión y diagnóstico', 'Desde Q300', 60, 15, 30, false, 'Revisión de datos en vivo y parámetros.'),
('compra-segura', 'Compra Segura', 'Revisión y diagnóstico', 'Desde Q450', 90, 30, 45, false, 'Revisión precompra básica.'),
('compra-segura-avanzada', 'Compra Segura Avanzada', 'Revisión y diagnóstico', 'Desde Q850', 150, 45, 60, true, 'Revisión precompra avanzada.'),
('diagnostico-pro', 'Diagnóstico Pro', 'Revisión y diagnóstico', 'Desde Q550', 120, 30, 45, true, 'Diagnóstico para fallas complejas o intermitentes.'),
('aprendizajes-calibraciones-simples', 'Aprendizajes / calibraciones simples', 'Revisión y diagnóstico', 'Desde Q300', 60, 15, 30, true, 'Procedimientos de aprendizaje o calibración simples.'),
('reset-mantenimiento-servicio', 'Reset mantenimiento / servicio', 'Mantenimiento', 'Desde Q150', 30, 10, 15, false, 'Reseteo de indicadores de mantenimiento.'),
('mantenimiento-express-mo', 'Mantenimiento Express MO', 'Mantenimiento', 'Desde Q250 MO', 75, 15, 30, false, 'Mano de obra para mantenimiento express.'),
('servicio-menor-full', 'Servicio Menor Full', 'Mantenimiento', 'Desde Q650', 120, 30, 45, false, 'Servicio menor con revisión de puntos críticos.'),
('servicio-menor-plus', 'Servicio Menor Plus', 'Mantenimiento', 'Desde Q850', 150, 30, 45, false, 'Servicio menor plus con revisión extendida.'),
('filtro-cabina-instalado', 'Filtro de cabina instalado', 'Mantenimiento', 'Desde Q175', 30, 10, 15, false, 'Instalación de filtro de cabina.'),
('servicio-frenos-recomendado', 'Servicio de Frenos Recomendado', 'Frenos', 'Desde Q1,050 por eje', 150, 30, 60, true, 'Servicio de frenos por eje según inspección.')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  price_from = excluded.price_from,
  duration_minutes = excluded.duration_minutes,
  buffer_before = excluded.buffer_before,
  buffer_after = excluded.buffer_after,
  requires_approval = excluded.requires_approval,
  description = excluded.description,
  active = true,
  updated_at = now();
