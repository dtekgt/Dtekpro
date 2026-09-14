-- =====================================================================
-- D-TEK GT · Foto opcional por línea del recibo — 13 sep 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- work_order_items (19_lineas_de_recibo.sql) tiene descripción, cantidad
-- y precio, pero ninguna línea puede llevar foto. Las revisiones del
-- expediente sí tienen foto desde hace tiempo (24_reporte_vivo_taller.sql,
-- bucket vehicle-inspections) — esto extiende esa misma idea a las líneas
-- del recibo, reusando el mismo bucket y la misma política de storage
-- (la ruta sigue siendo <vehicle_id>/<appointment_id>/<slug>/<uuid>.jpg,
-- así que vehicle_inspections_client_read ya la cubre sin tocar storage).
--
-- No borra ni cambia nada de lo que ya existe: un recibo viejo sin fotos
-- sigue funcionando igual, solo que sin ese dato.
--
-- Se corre una vez, en Supabase → SQL Editor. Requiere 19_lineas_de_recibo
-- y 24_reporte_vivo_taller ya aplicados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. La columna
-- ---------------------------------------------------------------------
alter table public.work_order_items
  add column if not exists photo_path text;


-- ---------------------------------------------------------------------
-- 2. Guardar la foto junto con el resto de la línea
--
--    Mismo cuerpo que 19_lineas_de_recibo.sql, solo que el insert ahora
--    también lee item->>'photo_path'. El resto de la función no cambia.
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_cerrar_trabajo(
  p_appointment_id uuid,
  p_diagnosis text default null,
  p_recommendations text default null,
  p_parts_notes text default null,
  p_mileage int default null,
  p_items jsonb default '[]'::jsonb,
  p_cerrar_cita boolean default true
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden public.work_orders;
  v_mano numeric := 0;
  v_partes numeric := 0;
  v_fecha date;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Solo un administrador puede cerrar un trabajo.';
  end if;

  if not exists (select 1 from public.appointments where id = p_appointment_id) then
    raise exception 'La cita no existe.';
  end if;

  select scheduled_start::date into v_fecha
    from public.appointments where id = p_appointment_id;

  insert into public.work_orders (
    appointment_id, diagnosis, recommendations, parts_notes,
    labor_total, parts_total, grand_total, status,
    mileage_at_service, service_date
  )
  values (
    p_appointment_id, p_diagnosis, p_recommendations, p_parts_notes,
    0, 0, 0, 'completed',
    p_mileage, v_fecha
  )
  on conflict (appointment_id) do update set
    diagnosis          = excluded.diagnosis,
    recommendations    = excluded.recommendations,
    parts_notes        = excluded.parts_notes,
    status             = 'completed',
    mileage_at_service = coalesce(excluded.mileage_at_service, work_orders.mileage_at_service),
    service_date       = coalesce(excluded.service_date, work_orders.service_date),
    updated_at         = now()
  returning * into v_orden;

  -- las líneas se reemplazan enteras: es lo que el panel acaba de mandar
  delete from public.work_order_items where work_order_id = v_orden.id;

  insert into public.work_order_items (work_order_id, description, kind, quantity, unit_price, service_id, photo_path, position)
  select
    v_orden.id,
    nullif(trim(item->>'description'), ''),
    coalesce(nullif(item->>'kind', ''), 'part'),
    coalesce((item->>'quantity')::numeric, 1),
    coalesce((item->>'unit_price')::numeric, 0),
    nullif(item->>'service_id', ''),
    nullif(item->>'photo_path', ''),
    coalesce((item->>'position')::int, ordinalidad::int)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(item, ordinalidad)
  where nullif(trim(item->>'description'), '') is not null;

  -- los totales salen del detalle, no se escriben a mano
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

  -- el kilometraje del carro se pone al día si el del servicio es mayor
  if p_mileage is not null then
    update public.vehicles v
       set mileage = p_mileage, updated_at = now()
      from public.appointments a
     where a.id = p_appointment_id
       and v.id = a.vehicle_id
       and (v.mileage is null or v.mileage < p_mileage);
  end if;

  -- cerrar la cita: esto es lo que antes no pasaba
  if p_cerrar_cita then
    update public.appointments
       set status = 'completed', updated_at = now()
     where id = p_appointment_id
       and status <> 'cancelled';
  end if;

  return v_orden;
end;
$$;

grant execute on function public.dtek_admin_cerrar_trabajo(uuid, text, text, text, int, jsonb, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Devolver la foto al leer el recibo — admin (WhatsApp / reabrir)
-- ---------------------------------------------------------------------
create or replace function public.dtek_recibo(p_appointment_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'cliente',   coalesce(p.full_name, a.client_name),
    'telefono',  coalesce(p.phone, a.client_phone),
    'vehiculo',  trim(concat_ws(' ', v.brand, v.line, v.year::text)),
    'placa',     v.plate,
    'km',        coalesce(w.mileage_at_service, v.mileage),
    'fecha',     coalesce(w.service_date, a.scheduled_start::date),
    'servicio',  a.service_id,
    'hallazgos', w.diagnosis,
    'recomendaciones', w.recommendations,
    'notas',     w.parts_notes,
    'lineas',    coalesce((
      select jsonb_agg(jsonb_build_object(
               'descripcion', i.description,
               'tipo',        i.kind,
               'cantidad',    i.quantity,
               'precio',      i.unit_price,
               'subtotal',    i.subtotal,
               'foto',        i.photo_path
             ) order by i.position, i.created_at)
      from public.work_order_items i
      where i.work_order_id = w.id
    ), '[]'::jsonb),
    'mano_obra', w.labor_total,
    'repuestos', w.parts_total,
    'total',     w.grand_total,
    'estado',    w.status
  )
  from public.appointments a
  left join public.work_orders w on w.appointment_id = a.id
  left join public.vehicles v    on v.id = a.vehicle_id
  left join public.profiles p    on p.id = a.client_id
  where a.id = p_appointment_id
    and (
      a.client_id = auth.uid()
      or exists (select 1 from public.profiles x where x.id = auth.uid() and x.role = 'admin')
    );
$$;

grant execute on function public.dtek_recibo(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Devolver la foto al leer el recibo — Garage del cliente
--
--    Mismo cuerpo que 22_recibo_cliente_lineas.sql, con 'foto' agregado
--    al jsonb de cada línea. La tabla que devuelve no cambia de forma
--    (sigue siendo una columna "lineas" jsonb), así que no hace falta
--    soltar la función antes de reemplazarla.
-- ---------------------------------------------------------------------
create or replace function public.dtek_client_list_my_work_orders()
returns table (
  id uuid,
  appointment_id uuid,
  service_name text,
  vehicle_summary text,
  scheduled_start timestamptz,
  diagnosis text,
  recommendations text,
  parts_notes text,
  labor_total numeric,
  parts_total numeric,
  grand_total numeric,
  mileage_at_service int,
  service_date date,
  status text,
  created_at timestamptz,
  lineas jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    wo.id,
    wo.appointment_id,
    s.name as service_name,
    concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text) as vehicle_summary,
    a.scheduled_start,
    wo.diagnosis,
    wo.recommendations,
    wo.parts_notes,
    wo.labor_total,
    wo.parts_total,
    wo.grand_total,
    wo.mileage_at_service,
    wo.service_date,
    wo.status,
    wo.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'descripcion', i.description,
               'tipo',        i.kind,
               'cantidad',    i.quantity,
               'precio',      i.unit_price,
               'subtotal',    i.subtotal,
               'foto',        i.photo_path
             ) order by i.position, i.created_at)
      from public.work_order_items i
      where i.work_order_id = wo.id
    ), '[]'::jsonb) as lineas
  from public.work_orders wo
  join public.appointments a on a.id = wo.appointment_id
  left join public.services s on s.id = a.service_id
  where auth.uid() is not null
    and (a.client_id = auth.uid() or lower(a.client_email) = lower(auth.email()))
  order by wo.created_at desc;
$$;

grant execute on function public.dtek_client_list_my_work_orders() to authenticated;
