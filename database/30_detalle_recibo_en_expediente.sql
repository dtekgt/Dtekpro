-- =====================================================================
-- D-TEK GT · El detalle del recibo llega al expediente del cliente — 13 sep 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- El cliente abre su historial (cliente.html#/servicio/<id>, expediente.js)
-- y hasta ahora solo veía "Mano de obra / Repuestos / Total": esa vista lee
-- dtek_client_list_vehicle_history() (07_vehicle_history.sql, v16), que es
-- anterior a que el recibo guardara líneas (19_lineas_de_recibo.sql).
--
-- dtek_client_list_my_work_orders() (22_recibo_cliente_lineas.sql) sí
-- devuelve las líneas desde agosto, pero esa función alimenta una lista
-- aparte (#clientWorkOrders) que no es la que el cliente realmente usa
-- para ver un servicio puntual — el expediente es esa vista.
--
-- Esto agrega "lineas" (con foto, ver 29_foto_en_recibo.sql) a la función
-- que sí lee el expediente. No borra ni cambia nada de lo que ya existe:
-- una cita sin líneas sigue mostrando el resumen de mano de obra/repuestos.
--
-- El tipo de retorno cambia (columna nueva), así que hay que soltar la
-- función antes, igual que hizo 22_recibo_cliente_lineas.sql.
--
-- Se corre una vez, en Supabase → SQL Editor. Requiere 19_lineas_de_recibo
-- y 29_foto_en_recibo ya aplicados.
-- =====================================================================

drop function if exists public.dtek_client_list_vehicle_history(uuid);

create or replace function public.dtek_client_list_vehicle_history(
  p_vehicle_id uuid
)
returns table (
  id uuid,
  kind text,
  appointment_id uuid,
  service_id text,
  service_name text,
  service_price text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  appointment_status text,
  work_order_status text,
  symptom text,
  location text,
  diagnosis text,
  recommendations text,
  parts_notes text,
  labor_total numeric,
  parts_total numeric,
  grand_total numeric,
  mileage_at_service int,
  service_date date,
  lineas jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(wo.id, a.id) as id,
    case when wo.id is null then 'appointment' else 'work_order' end as kind,
    a.id as appointment_id,
    a.service_id,
    s.name as service_name,
    s.price_from as service_price,
    a.scheduled_start,
    a.scheduled_end,
    a.status as appointment_status,
    wo.status as work_order_status,
    a.symptom,
    a.location,
    wo.diagnosis,
    wo.recommendations,
    wo.parts_notes,
    wo.labor_total,
    wo.parts_total,
    wo.grand_total,
    wo.mileage_at_service,
    wo.service_date,
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
    ), '[]'::jsonb) as lineas,
    coalesce(wo.created_at, a.created_at) as created_at
  from public.appointments a
  join public.vehicles v on v.id = a.vehicle_id
  left join public.services s on s.id = a.service_id
  left join public.work_orders wo on wo.appointment_id = a.id
  where auth.uid() is not null
    and v.id = p_vehicle_id
    and v.owner_id = auth.uid()
  order by coalesce(a.scheduled_start, a.created_at) desc;
$$;

grant execute on function public.dtek_client_list_vehicle_history(uuid) to authenticated;
