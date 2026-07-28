-- =====================================================================
-- D-TEK GT · Líneas del recibo — 28 jul 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- El recibo detalla "Descripción | Cantidad | Precio unitario | Subtotal",
-- pero work_orders solo guardaba tres números sueltos: mano de obra,
-- repuestos y total. No había dónde escribir las líneas.
--
-- Esto agrega esa tabla. No borra ni cambia nada de lo que ya existe:
-- los reportes viejos siguen funcionando igual, solo que sin detalle.
--
-- Se corre una vez, en Supabase → SQL Editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Las líneas
-- ---------------------------------------------------------------------
create table if not exists public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,

  -- "Cambio de balatas delanteras", "Juego de pastillas", "Mano de obra"
  description text not null,

  -- Separar repuesto de mano de obra permite saber después cuánto se fue
  -- en piezas y cuánto en trabajo, sin adivinar por el texto.
  kind text not null default 'part' check (kind in ('part', 'labor', 'service')),

  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),

  -- Subtotal calculado por la base: nunca puede quedar desalineado
  -- con cantidad × precio, ni por un error de tecleo ni de redondeo.
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored,

  -- Si la línea salió del catálogo, queda el rastro
  service_id text references public.services(id) on delete set null,

  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists work_order_items_order_idx
  on public.work_order_items (work_order_id, position);


-- ---------------------------------------------------------------------
-- 2. El kilometraje del día
--
--    El recibo lleva el millaje del vehículo. Hoy vive en vehicles.mileage
--    y se queda congelado desde que se registró el carro. Cada servicio
--    debe anotar el km de ESE día: es lo que hace útil el historial.
-- ---------------------------------------------------------------------
alter table public.work_orders
  add column if not exists mileage_at_service int,
  add column if not exists service_date date;


-- ---------------------------------------------------------------------
-- 3. Permisos
--
--    El cliente lee las líneas de sus propios servicios. Escribir, solo
--    el admin. Mismo criterio que el resto del portal.
-- ---------------------------------------------------------------------
alter table public.work_order_items enable row level security;

drop policy if exists work_order_items_lectura_cliente on public.work_order_items;
create policy work_order_items_lectura_cliente
  on public.work_order_items for select
  using (
    exists (
      select 1
      from public.work_orders w
      join public.appointments a on a.id = w.appointment_id
      where w.id = work_order_items.work_order_id
        and a.client_id = auth.uid()
    )
  );

drop policy if exists work_order_items_admin on public.work_order_items;
create policy work_order_items_admin
  on public.work_order_items for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------------------
-- 4. Guardar el reporte completo, con líneas, en una sola operación
--
--    Reemplaza las líneas anteriores por las nuevas, recalcula los totales
--    desde el detalle y —esto es lo que faltaba— marca la cita como
--    realizada. Antes se guardaba el reporte y la cita quedaba abierta:
--    por eso había trabajos hechos que el sistema no daba por cerrados.
--
--    Todo dentro de una transacción: o entra completo o no entra.
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
-- 5. Leer un recibo completo, para armarlo en el panel o en el Garage
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
               'subtotal',    i.subtotal
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
-- 6. Qué trabajos quedaron sin cerrar
--
--    La razón por la que hay citas realizadas con Q0: nada avisaba.
-- ---------------------------------------------------------------------
create or replace view public.dtek_trabajos_pendientes as
select
  a.id as appointment_id,
  a.client_name,
  a.service_id,
  a.scheduled_start,
  trim(concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text)) as vehiculo,
  a.status as estado_cita,
  w.status as estado_reporte,
  w.grand_total,
  case
    when w.id is null                       then 'sin reporte'
    when coalesce(w.grand_total, 0) = 0     then 'sin total'
    when a.status <> 'completed'            then 'cita sin cerrar'
  end as motivo
from public.appointments a
left join public.work_orders w on w.appointment_id = a.id
where a.scheduled_start < now()
  and a.status <> 'cancelled'
  and (w.id is null or coalesce(w.grand_total, 0) = 0 or a.status <> 'completed');
