-- =====================================================================
-- D-TEK GT · Panel de Finanzas: gastos + resumen — 14 sep 2026
-- Propiedad de D-TEK GT / Dominic Morales.
--
-- D-TEK solo registraba ingresos (work_orders/work_order_items). No existía
-- ninguna tabla de gastos, cuentas de efectivo, activos ni pasivos. Esto
-- agrega lo mínimo real y honesto:
--
-- 1. Una tabla de gastos (expenses) para empezar a alimentarla a mano,
--    poco a poco — hoy no hay ningún otro lugar donde eso viva.
-- 2. Un resumen financiero (dtek_admin_finance_summary) que solo suma lo
--    que existe de verdad: ingresos (de work_orders) y gastos (de la
--    tabla nueva). NO calcula "costo de repuestos" ni "utilidad bruta"
--    en el sentido contable, porque el sistema nunca guardó cuánto pagó
--    D-TEK por un repuesto — parts_total es lo que se LE COBRÓ al
--    cliente por repuestos y servicios, no un costo. Por eso el desglose
--    se llama "mezcla de ingresos", no "costo".
--
-- Deliberadamente NO incluye balance general ni flujo de efectivo: esos
-- necesitan cuentas de efectivo, cuentas por cobrar/pagar y activos, que
-- no existen en ningún lado. Fabricarlos ahora sería mostrar números
-- inventados con apariencia de balance formal.
--
-- No borra ni cambia nada de lo que ya existe.
--
-- Se corre una vez, en Supabase → SQL Editor. Requiere 01_schema.sql,
-- 19_lineas_de_recibo.sql, 12_v22_loyalty_referrals.sql y
-- 13_v27_points_rewards.sql ya aplicados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Gastos
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null default 'otro'
    check (category in ('repuestos_inventario', 'renta', 'sueldos', 'servicios', 'marketing', 'herramientas_equipo', 'otro')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);

alter table public.expenses enable row level security;

-- Mismo criterio que work_order_items_admin (19_lineas_de_recibo.sql):
-- solo un admin puede ver o tocar gastos. No hay lectura de cliente —
-- esto no es información del cliente, es interna del negocio.
drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin
  on public.expenses for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));


-- ---------------------------------------------------------------------
-- 2. Crear, borrar y listar gastos
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_create_expense(
  p_expense_date date,
  p_category text,
  p_description text,
  p_amount numeric
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gasto public.expenses;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Solo un administrador puede registrar gastos.';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Escribí una descripción del gasto.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a cero.';
  end if;

  insert into public.expenses (expense_date, category, description, amount, created_by)
  values (
    coalesce(p_expense_date, current_date),
    coalesce(nullif(p_category, ''), 'otro'),
    trim(p_description),
    p_amount,
    auth.uid()
  )
  returning * into v_gasto;

  return v_gasto;
end;
$$;

grant execute on function public.dtek_admin_create_expense(date, text, text, numeric) to authenticated;


create or replace function public.dtek_admin_delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Solo un administrador puede borrar un gasto.';
  end if;

  delete from public.expenses where id = p_expense_id;
end;
$$;

grant execute on function public.dtek_admin_delete_expense(uuid) to authenticated;


create or replace function public.dtek_admin_list_expenses(p_desde date, p_hasta date)
returns setof public.expenses
language sql
security definer
set search_path = public
as $$
  select *
  from public.expenses
  where (p_desde is null or expense_date >= p_desde)
    and (p_hasta is null or expense_date <= p_hasta)
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  order by expense_date desc, created_at desc;
$$;

grant execute on function public.dtek_admin_list_expenses(date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Resumen financiero de un período
--
--    Un solo viaje que alimenta Resumen + Estado de resultados + Índices
--    a la vez, mismo criterio que ya usa el resto del panel (una carga,
--    varios render). service_date no siempre está (recibos viejos antes
--    de 19_lineas_de_recibo.sql), así que cae a la fecha de la cita.
-- ---------------------------------------------------------------------
create or replace function public.dtek_admin_finance_summary(p_desde date, p_hasta date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desde date := coalesce(p_desde, date_trunc('month', current_date)::date);
  v_hasta date := coalesce(p_hasta, current_date);
  v_dias int;
  v_desde_prev date;
  v_hasta_prev date;
  v_ingresos_total numeric;
  v_ingresos_mano_obra numeric;
  v_ingresos_repuestos numeric;
  v_trabajos_count int;
  v_gastos_total numeric;
  v_ingresos_total_prev numeric;
  v_gastos_total_prev numeric;
  v_puntos_pendientes bigint;
  v_puntos_ratio numeric;
  v_referidos jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Solo un administrador puede ver el resumen financiero.';
  end if;

  if v_desde > v_hasta then
    raise exception 'El rango de fechas no es válido.';
  end if;

  v_dias := (v_hasta - v_desde) + 1;
  v_hasta_prev := v_desde - 1;
  v_desde_prev := v_desde - v_dias;

  select
    coalesce(sum(w.grand_total), 0),
    coalesce(sum(w.labor_total), 0),
    coalesce(sum(w.parts_total), 0),
    count(*)
  into v_ingresos_total, v_ingresos_mano_obra, v_ingresos_repuestos, v_trabajos_count
  from public.work_orders w
  join public.appointments a on a.id = w.appointment_id
  where w.status = 'completed'
    and coalesce(w.service_date, a.scheduled_start::date) between v_desde and v_hasta;

  select coalesce(sum(amount), 0) into v_gastos_total
  from public.expenses
  where expense_date between v_desde and v_hasta;

  select coalesce(sum(w.grand_total), 0) into v_ingresos_total_prev
  from public.work_orders w
  join public.appointments a on a.id = w.appointment_id
  where w.status = 'completed'
    and coalesce(w.service_date, a.scheduled_start::date) between v_desde_prev and v_hasta_prev;

  select coalesce(sum(amount), 0) into v_gastos_total_prev
  from public.expenses
  where expense_date between v_desde_prev and v_hasta_prev;

  -- Saldo acumulado de puntos otorgados y no canjeados, de TODO el negocio
  -- (no es de período: es una obligación futura de descuento que se
  -- arrastra). Convertido a Q con la razón real de la recompensa tipo
  -- "credit" del catálogo — si esa fila cambia de precio, esto se ajusta
  -- solo. 1 si no hay ninguna fila de crédito (no debería pasar).
  select coalesce(sum(points), 0) into v_puntos_pendientes from public.points_ledger;

  select coalesce(credit_amount / nullif(points_cost, 0), 1)
    into v_puntos_ratio
  from public.reward_catalog
  where reward_type = 'credit' and credit_amount is not null
  order by sort_order
  limit 1;

  select jsonb_build_object(
    'submitted', count(*) filter (where status = 'submitted'),
    'contacted', count(*) filter (where status = 'contacted'),
    'scheduled', count(*) filter (where status = 'scheduled'),
    'converted', count(*) filter (where status = 'converted'),
    'discarded', count(*) filter (where status = 'discarded')
  ) into v_referidos
  from public.referrals
  where created_at::date between v_desde and v_hasta;

  return jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'ingresos_total', v_ingresos_total,
    'ingresos_mano_obra', v_ingresos_mano_obra,
    'ingresos_repuestos_servicios', v_ingresos_repuestos,
    'trabajos_count', v_trabajos_count,
    'ticket_promedio', case when v_trabajos_count > 0 then round(v_ingresos_total / v_trabajos_count, 2) else 0 end,
    'gastos_total', v_gastos_total,
    'utilidad_neta', v_ingresos_total - v_gastos_total,
    'periodo_anterior', jsonb_build_object(
      'desde', v_desde_prev,
      'hasta', v_hasta_prev,
      'ingresos_total', v_ingresos_total_prev,
      'gastos_total', v_gastos_total_prev,
      'utilidad_neta', v_ingresos_total_prev - v_gastos_total_prev
    ),
    'puntos_pendientes', v_puntos_pendientes,
    'puntos_valor_q', round(v_puntos_pendientes * v_puntos_ratio, 2),
    'referidos', v_referidos
  );
end;
$$;

grant execute on function public.dtek_admin_finance_summary(date, date) to authenticated;
