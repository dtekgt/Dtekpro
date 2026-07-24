-- D-TEK GT Web OS v12 — Diagnóstico rápido Supabase

-- 1) Verificar que las funciones públicas existen
select proname from pg_proc where proname in (
  'dtek_get_busy_blocks',
  'dtek_create_public_appointment',
  'dtek_admin_update_appointment_status',
  'dtek_admin_create_blocked_time'
);

-- 2) Ver últimas citas
select id, service_id, client_name, client_email, scheduled_start, scheduled_end, block_start, block_end, status, source, created_at
from public.appointments
order by created_at desc
limit 20;

-- 3) Ver perfil admin
select email, full_name, role, phone from public.profiles where email = 'rgdominicm@gmail.com';
