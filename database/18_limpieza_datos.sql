-- =====================================================================
-- D-TEK GT · Limpieza de datos de prueba — 27 jul 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
--   ANTES DE CORRER ESTO:
--   1. Corré 17_auditoria_datos.sql y revisá los resultados.
--   2. Hacé un respaldo en Supabase: Database → Backups → Create backup.
--      Sin respaldo no hay vuelta atrás. Esto borra de verdad.
--   3. Pegá abajo SOLO los ids que decidiste borrar.
--
--   Este archivo NO adivina qué borrar. Si no pegás ids, no hace nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 · Qué cuentas se van
--
--   Pegá un id por línea, entre comillas y separados por coma.
--   Los sacás de la columna "id" de la auditoría.
--   Si dejás la lista vacía, los pasos siguientes no borran nada.
-- ---------------------------------------------------------------------
drop table if exists tmp_a_borrar;
create temp table tmp_a_borrar (id uuid primary key);

insert into tmp_a_borrar (id) values
  -- ('00000000-0000-0000-0000-000000000000'),
  -- ('11111111-1111-1111-1111-111111111111')
  ;


-- ---------------------------------------------------------------------
-- PASO 2 · Red de seguridad
--
--   Saca de la lista cualquier cuenta admin o con trabajo facturado,
--   por si se coló una por error al copiar y pegar.
-- ---------------------------------------------------------------------
delete from tmp_a_borrar t
using public.profiles p
where p.id = t.id and p.role = 'admin';

delete from tmp_a_borrar t
where exists (
  select 1
  from public.appointments a
  join public.work_orders w on w.appointment_id = a.id
  where a.client_id = t.id and coalesce(w.grand_total, 0) > 0
);


-- ---------------------------------------------------------------------
-- PASO 3 · Ensayo: qué se borraría exactamente
--
--   Corré SOLO hasta aquí y leé los números. Si algo no cuadra, parás.
-- ---------------------------------------------------------------------
select 'cuentas'            as que, count(*) as filas from tmp_a_borrar
union all
select 'vehiculos',        count(*) from public.vehicles v      where v.owner_id in (select id from tmp_a_borrar)
union all
select 'citas',            count(*) from public.appointments a  where a.client_id in (select id from tmp_a_borrar)
union all
select 'reportes',         count(*) from public.work_orders w
  where w.appointment_id in (select id from public.appointments where client_id in (select id from tmp_a_borrar))
union all
select 'mensajes',         count(*) from public.communications c
  where c.client_id in (select id from tmp_a_borrar)
     or c.appointment_id in (select id from public.appointments where client_id in (select id from tmp_a_borrar))
union all
select 'puntos',           count(*) from public.points_ledger      where owner_id in (select id from tmp_a_borrar)
union all
select 'saldo lealtad',    count(*) from public.loyalty_ledger     where owner_id in (select id from tmp_a_borrar)
union all
select 'canjes',           count(*) from public.reward_redemptions where owner_id in (select id from tmp_a_borrar)
union all
select 'referidos',        count(*) from public.referrals          where referrer_id in (select id from tmp_a_borrar);

-- Y con nombre y apellido, para que las reconozcas:
select
  p.id,
  coalesce(p.email, p.username, p.full_name, '(sin nombre)') as cuenta,
  p.role,
  p.created_at::date as creada,
  (select count(*) from public.vehicles v where v.owner_id = p.id)      as carros,
  (select count(*) from public.appointments a where a.client_id = p.id) as citas
from public.profiles p
where p.id in (select id from tmp_a_borrar)
order by cuenta;


-- ---------------------------------------------------------------------
-- PASO 4 · El borrado
--
--   Quitá el comentario del bloque completo SOLO cuando el paso 3 te
--   haya mostrado exactamente lo que esperabas.
--
--   Va dentro de una transacción: si algo falla a medias, no queda nada
--   a medio borrar.
--
--   El orden importa. Las citas no se borran solas al borrar la cuenta
--   (quedan huérfanas con client_id en null), así que van primero.
-- ---------------------------------------------------------------------
/*
begin;

  -- 4.1 · mensajes de esas cuentas y de sus citas
  delete from public.communications
   where client_id in (select id from tmp_a_borrar)
      or appointment_id in (select id from public.appointments
                             where client_id in (select id from tmp_a_borrar));

  -- 4.2 · reportes técnicos de sus citas
  delete from public.work_orders
   where appointment_id in (select id from public.appointments
                             where client_id in (select id from tmp_a_borrar));

  -- 4.3 · movimientos de puntos y saldo ligados a esas citas
  delete from public.points_ledger
   where owner_id in (select id from tmp_a_borrar)
      or appointment_id in (select id from public.appointments
                             where client_id in (select id from tmp_a_borrar));

  delete from public.loyalty_ledger  where owner_id in (select id from tmp_a_borrar);
  delete from public.reward_redemptions where owner_id in (select id from tmp_a_borrar);
  delete from public.referrals       where referrer_id in (select id from tmp_a_borrar);

  -- 4.4 · las citas
  delete from public.appointments where client_id in (select id from tmp_a_borrar);

  -- 4.5 · los carros
  delete from public.vehicles where owner_id in (select id from tmp_a_borrar);

  -- 4.6 · la cuenta de acceso. Al borrarla se va sola el perfil,
  --       porque profiles.id apunta a auth.users con on delete cascade.
  delete from auth.users where id in (select id from tmp_a_borrar);

commit;
*/


-- ---------------------------------------------------------------------
-- PASO 5 · Basura suelta que no depende de ninguna cuenta
--
--   Esto se puede correr aunque no borres ninguna cuenta.
--   Son filas que ya quedaron sin dueño de antes.
-- ---------------------------------------------------------------------
/*
begin;

  -- reportes cuya cita ya no existe
  delete from public.work_orders w
   where not exists (select 1 from public.appointments a where a.id = w.appointment_id);

  -- mensajes cuya cita ya no existe
  delete from public.communications c
   where c.appointment_id is not null
     and not exists (select 1 from public.appointments a where a.id = c.appointment_id);

  -- movimientos de puntos cuya cuenta ya no existe
  delete from public.points_ledger l
   where not exists (select 1 from public.profiles p where p.id = l.owner_id);

commit;
*/


-- ---------------------------------------------------------------------
-- PASO 6 · Comprobar cómo quedó
-- ---------------------------------------------------------------------
select 'profiles' as tabla, count(*) as filas from public.profiles
union all select 'vehicles',       count(*) from public.vehicles
union all select 'appointments',   count(*) from public.appointments
union all select 'work_orders',    count(*) from public.work_orders
union all select 'points_ledger',  count(*) from public.points_ledger
union all select 'auth.users',     count(*) from auth.users
order by tabla;


-- =====================================================================
-- Alternativa si dudás de una cuenta: en vez de borrarla, despersonalizala.
-- Conservás el historial de servicios (que sirve para tus estadísticas)
-- y quitás el dato personal.
--
--   update public.profiles
--      set full_name = 'Cliente retirado',
--          email = null,
--          phone = null,
--          username = null
--    where id = 'PEGA-EL-ID-AQUI';
-- =====================================================================
