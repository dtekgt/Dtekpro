-- D-TEK GT Web OS v11 — Admin workflow RPC
-- Correr en Supabase SQL Editor después de 01_schema.sql, 02_seed_services.sql y 03_scheduler_rpc.sql.
-- Agrega acciones seguras de admin: cambiar estado, bloquear horario y registrar notas.

create or replace function public.dtek_admin_update_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_note text default null
)
returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.appointments;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede cambiar estados';
  end if;

  if p_status not in ('requested', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Estado inválido: %', p_status;
  end if;

  update public.appointments
  set status = p_status,
      updated_at = now()
  where id = p_appointment_id
  returning * into v_app;

  if v_app.id is null then
    raise exception 'Cita no encontrada';
  end if;

  insert into public.communications (
    appointment_id,
    client_id,
    type,
    direction,
    content
  ) values (
    v_app.id,
    v_app.client_id,
    'note',
    'internal',
    coalesce(nullif(trim(p_note), ''), 'Estado actualizado a ' || p_status)
  );

  if p_status = 'completed' and not exists (
    select 1 from public.work_orders where appointment_id = v_app.id
  ) then
    insert into public.work_orders (
      appointment_id,
      status,
      diagnosis,
      recommendations
    ) values (
      v_app.id,
      'open',
      'Pendiente de documentar diagnóstico final.',
      'Pendiente de recomendaciones.'
    );
  end if;

  return query select * from public.appointments where id = v_app.id;
end;
$$;

grant execute on function public.dtek_admin_update_appointment_status(uuid, text, text) to authenticated;

create or replace function public.dtek_admin_create_blocked_time(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_reason text default 'Bloqueo manual D-TEK'
)
returns setof public.blocked_times
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block public.blocked_times;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede bloquear horarios';
  end if;

  if p_start_time >= p_end_time then
    raise exception 'Rango de bloqueo inválido';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.status <> 'cancelled'
      and p_start_time < a.block_end
      and a.block_start < p_end_time
  ) then
    raise exception 'Ese bloqueo choca con una cita existente';
  end if;

  insert into public.blocked_times (
    start_time,
    end_time,
    reason,
    created_by
  ) values (
    p_start_time,
    p_end_time,
    coalesce(nullif(trim(p_reason), ''), 'Bloqueo manual D-TEK'),
    auth.uid()
  ) returning * into v_block;

  return query select * from public.blocked_times where id = v_block.id;
end;
$$;

grant execute on function public.dtek_admin_create_blocked_time(timestamptz, timestamptz, text) to authenticated;

create or replace function public.dtek_admin_delete_blocked_time(
  p_block_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede eliminar bloqueos';
  end if;

  delete from public.blocked_times where id = p_block_id;
  return true;
end;
$$;

grant execute on function public.dtek_admin_delete_blocked_time(uuid) to authenticated;
