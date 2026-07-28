-- =====================================================================
-- D-TEK GT · Auditoría de datos — 27 jul 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- ESTE ARCHIVO NO BORRA NADA. Solo mira y clasifica.
-- Corré cada bloque en el SQL Editor de Supabase y revisá los resultados.
-- El borrado va aparte, en 18_limpieza_datos.sql, y solo después de esto.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Cuánto hay en cada tabla
-- ---------------------------------------------------------------------
select 'profiles'           as tabla, count(*) as filas from public.profiles
union all select 'vehicles',           count(*) from public.vehicles
union all select 'appointments',       count(*) from public.appointments
union all select 'work_orders',        count(*) from public.work_orders
union all select 'communications',     count(*) from public.communications
union all select 'points_ledger',      count(*) from public.points_ledger
union all select 'loyalty_ledger',     count(*) from public.loyalty_ledger
union all select 'referrals',          count(*) from public.referrals
union all select 'reward_redemptions', count(*) from public.reward_redemptions
union all select 'blocked_times',      count(*) from public.blocked_times
union all select 'auth.users',         count(*) from auth.users
order by tabla;


-- ---------------------------------------------------------------------
-- 2. Cada cuenta, con su actividad real y por qué parece de prueba
--
--    Leé la columna "sospecha". Si viene vacía, la cuenta se ve normal.
--    Nada se decide solo: la última palabra es tuya.
-- ---------------------------------------------------------------------
with actividad as (
  select
    p.id,
    p.email,
    p.username,
    p.full_name,
    p.phone,
    p.role,
    p.created_at,
    (select count(*) from public.vehicles v where v.owner_id = p.id)             as carros,
    (select count(*) from public.appointments a where a.client_id = p.id)        as citas,
    (select count(*) from public.appointments a
       where a.client_id = p.id and a.status = 'completed')                      as citas_realizadas,
    (select count(*) from public.work_orders w
       join public.appointments a on a.id = w.appointment_id
      where a.client_id = p.id)                                                  as reportes,
    (select coalesce(sum(w.grand_total), 0) from public.work_orders w
       join public.appointments a on a.id = w.appointment_id
      where a.client_id = p.id)                                                  as facturado,
    (select max(a.scheduled_start) from public.appointments a
      where a.client_id = p.id)                                                  as ultima_cita
  from public.profiles p
)
select
  id,
  coalesce(email, username, full_name, '(sin nombre)') as cuenta,
  role,
  carros,
  citas,
  citas_realizadas,
  reportes,
  facturado,
  created_at::date        as creada,
  ultima_cita::date       as ultima_cita,
  nullif(trim(concat_ws(' · ',
    -- correos que delatan una prueba
    case when email ~* '(test|prueba|demo|asdf|qwer|ejemplo|example|foo|bar)'
         then 'correo de prueba' end,
    case when email ~* '\+(test|prueba|demo)@'      then 'alias +test' end,
    case when email ~* '@(example|test|mailinator|tempmail|yopmail)\.'
         then 'dominio desechable' end,
    -- nombres que nadie usa de verdad
    case when full_name ~* '^(test|prueba|demo|asd|aaa|qwe|xxx|zzz|\d+)'
         then 'nombre de prueba' end,
    case when length(coalesce(full_name, '')) between 1 and 2
         then 'nombre de 1 o 2 letras' end,
    case when username ~* '(test|prueba|demo|asd|qwe|123)'
         then 'usuario de prueba' end,
    -- teléfonos imposibles
    case when phone is not null
          and regexp_replace(phone, '\D', '', 'g') ~ '^(0+|1+|2+|3+|4+|5+|6+|7+|8+|9+|1234|12345678)$'
         then 'telefono repetido' end,
    case when phone is not null
          and length(regexp_replace(phone, '\D', '', 'g')) not between 8 and 13
         then 'telefono de largo raro' end,
    -- cuentas que nunca hicieron nada
    case when carros = 0 and citas = 0 and role <> 'admin'
         then 'sin carros ni citas' end,
    case when citas > 0 and citas_realizadas = 0 and facturado = 0
         then 'agendo pero nunca se realizo' end
  )), '') as sospecha
from actividad
order by
  (case when role = 'admin' then 0 else 1 end),
  facturado desc,
  citas desc,
  created_at;


-- ---------------------------------------------------------------------
-- 3. Vehículos que huelen a prueba
--
--    Ojo con las placas: 123qwe, aaa111, o teclado corrido.
-- ---------------------------------------------------------------------
select
  v.id,
  coalesce(p.email, p.username, '(dueño borrado)') as dueno,
  v.nickname,
  v.brand,
  v.line,
  v.year,
  v.plate,
  v.mileage,
  (select count(*) from public.appointments a where a.vehicle_id = v.id) as citas,
  v.created_at::date as creado,
  nullif(trim(concat_ws(' · ',
    case when v.plate ~* '(qwe|asd|zxc|123|abc|aaa|111|test|prueba)' then 'placa de teclado' end,
    case when v.plate is not null and length(regexp_replace(v.plate, '\W', '', 'g')) < 5 then 'placa muy corta' end,
    case when v.nickname ~* '(test|prueba|demo|asd|qwe|xxx)' then 'apodo de prueba' end,
    case when v.year is not null and (v.year < 1970 or v.year > extract(year from now()) + 1) then 'año imposible' end,
    case when v.mileage is not null and (v.mileage = 0 or v.mileage > 900000) then 'kilometraje raro' end,
    case when (select count(*) from public.appointments a where a.vehicle_id = v.id) = 0 then 'sin ninguna cita' end
  )), '') as sospecha
from public.vehicles v
left join public.profiles p on p.id = v.owner_id
order by sospecha nulls last, v.created_at;


-- ---------------------------------------------------------------------
-- 4. Citas que parecen ensayo
-- ---------------------------------------------------------------------
select
  a.id,
  a.client_name,
  a.client_email,
  a.client_phone,
  a.service_id,
  a.status,
  a.scheduled_start::date as dia,
  a.source,
  (select count(*) from public.work_orders w where w.appointment_id = a.id) as reportes,
  nullif(trim(concat_ws(' · ',
    case when a.client_name ~* '(test|prueba|demo|asd|qwe|aaa|xxx)' then 'nombre de prueba' end,
    case when a.client_email ~* '(test|prueba|demo|asdf|ejemplo|example)' then 'correo de prueba' end,
    case when a.symptom ~* '^(test|prueba|asd|qwe|\.|x+)$' then 'sintoma de prueba' end,
    case when a.client_id is null then 'sin cuenta ligada' end,
    case when a.scheduled_start < now() - interval '90 days' and a.status = 'requested'
         then 'solicitada y nunca atendida' end,
    case when a.scheduled_start > now() + interval '365 days' then 'agendada muy al futuro' end
  )), '') as sospecha
from public.appointments a
order by sospecha nulls last, a.scheduled_start desc;


-- ---------------------------------------------------------------------
-- 5. Basura suelta: filas que quedaron sin dueño
-- ---------------------------------------------------------------------
select 'citas sin cuenta ligada' as caso, count(*) as filas
  from public.appointments where client_id is null
union all
select 'citas sin vehiculo ligado', count(*)
  from public.appointments where vehicle_id is null
union all
select 'reportes sin cita', count(*)
  from public.work_orders w
  where not exists (select 1 from public.appointments a where a.id = w.appointment_id)
union all
select 'puntos sin cuenta', count(*)
  from public.points_ledger l
  where not exists (select 1 from public.profiles p where p.id = l.owner_id)
union all
select 'usuarios de auth sin perfil', count(*)
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
union all
select 'perfiles sin usuario de auth', count(*)
  from public.profiles p
  where not exists (select 1 from auth.users u where u.id = p.id);


-- ---------------------------------------------------------------------
-- 6. El resumen que importa: quién se queda
--
--    Una cuenta se considera REAL si tiene al menos un trabajo realizado
--    o facturado. Todo lo demás queda "por revisar" — no significa que
--    haya que borrarla, significa que la mirés vos.
-- ---------------------------------------------------------------------
with clasificacion as (
  select
    p.id,
    coalesce(p.email, p.username, p.full_name, '(sin nombre)') as cuenta,
    p.role,
    (select count(*) from public.appointments a
      where a.client_id = p.id and a.status = 'completed') as realizadas,
    (select coalesce(sum(w.grand_total), 0) from public.work_orders w
       join public.appointments a on a.id = w.appointment_id
      where a.client_id = p.id) as facturado
  from public.profiles p
)
select
  case
    when role = 'admin'                    then '1. ADMIN — no se toca'
    when realizadas > 0 or facturado > 0   then '2. REAL — tiene trabajo hecho'
    else                                        '3. POR REVISAR — sin trabajo hecho'
  end as grupo,
  count(*)          as cuentas,
  sum(realizadas)   as citas_realizadas,
  sum(facturado)    as facturado,
  string_agg(cuenta, ', ' order by cuenta) as quienes
from clasificacion
group by 1
order by 1;
