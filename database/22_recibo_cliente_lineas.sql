-- =====================================================================
-- D-TEK GT · El cliente ve el detalle de líneas en su Garage — 19 ago 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- database/19_lineas_de_recibo.sql (v32.0) agregó work_order_items y el
-- cierre del trabajo con detalle línea por línea, pero el panel comparte
-- ese recibo por WhatsApp — dtek_client_list_my_work_orders() (06) nunca
-- se actualizó, así que el Garage del cliente seguía mostrando solo el
-- total general, sin las líneas ni el kilometraje del día.
--
-- Esto agrega esas columnas a la función. No borra ni cambia nada de lo
-- que ya existe.
--
-- Se corre una vez, en Supabase → SQL Editor. Requiere 19_lineas_de_recibo
-- ya aplicado (work_order_items, work_orders.mileage_at_service/service_date).
-- =====================================================================

-- El tipo de retorno cambia, así que hay que soltar la función antes.
drop function if exists public.dtek_client_list_my_work_orders();

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
               'subtotal',    i.subtotal
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
