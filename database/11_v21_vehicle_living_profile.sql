-- D-TEK GT Web OS v21 — Expediente vivo del carro
-- Correr después de los SQL anteriores.
-- Enriquece vehicles para que el perfil del cliente se sienta propio y no repita datos.

alter table public.vehicles
  add column if not exists nickname text,
  add column if not exists mileage int,
  add column if not exists engine text,
  add column if not exists transmission text,
  add column if not exists use_type text;

-- Reemplaza la función de creación para aceptar datos extra sin romper la lógica anterior.
drop function if exists public.dtek_client_create_vehicle(text, text, int, text, text, text);

create or replace function public.dtek_client_create_vehicle(
  p_brand text,
  p_line text,
  p_year int,
  p_plate text default null,
  p_vin text default null,
  p_notes text default null,
  p_nickname text default null,
  p_mileage int default null,
  p_engine text default null,
  p_transmission text default null,
  p_use_type text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_brand, '')), '') is null then
    raise exception 'BRAND_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_line, '')), '') is null then
    raise exception 'LINE_REQUIRED';
  end if;

  insert into public.vehicles (
    owner_id,
    brand,
    line,
    year,
    plate,
    vin,
    notes,
    nickname,
    mileage,
    engine,
    transmission,
    use_type
  )
  values (
    auth.uid(),
    trim(p_brand),
    trim(p_line),
    p_year,
    nullif(trim(coalesce(p_plate, '')), ''),
    nullif(trim(coalesce(p_vin, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_nickname, '')), ''),
    p_mileage,
    nullif(trim(coalesce(p_engine, '')), ''),
    nullif(trim(coalesce(p_transmission, '')), ''),
    nullif(trim(coalesce(p_use_type, '')), '')
  )
  returning * into v_vehicle;

  return v_vehicle;
end;
$$;

-- Actualiza datos vivos del carro desde Mi D-TEK.
create or replace function public.dtek_client_update_vehicle_care(
  p_vehicle_id uuid,
  p_nickname text default null,
  p_mileage int default null,
  p_engine text default null,
  p_transmission text default null,
  p_use_type text default null,
  p_notes text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.vehicles
  set
    nickname = nullif(trim(coalesce(p_nickname, '')), ''),
    mileage = p_mileage,
    engine = nullif(trim(coalesce(p_engine, '')), ''),
    transmission = nullif(trim(coalesce(p_transmission, '')), ''),
    use_type = nullif(trim(coalesce(p_use_type, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    updated_at = now()
  where id = p_vehicle_id
    and owner_id = auth.uid()
  returning * into v_vehicle;

  if v_vehicle.id is null then
    raise exception 'VEHICLE_NOT_FOUND_OR_NOT_OWNER';
  end if;

  return v_vehicle;
end;
$$;

grant execute on function public.dtek_client_create_vehicle(text, text, int, text, text, text, text, int, text, text, text) to authenticated;
grant execute on function public.dtek_client_update_vehicle_care(uuid, text, int, text, text, text, text) to authenticated;
