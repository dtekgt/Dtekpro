-- D-TEK GT Web OS v9 — Supabase schema
-- Propiedad de D-TEK GT / Dominic Morales.
-- Correr en Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'client')),
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand text not null,
  line text not null,
  year int,
  plate text,
  vin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  price_from text,
  duration_minutes int not null default 60,
  buffer_before int not null default 15,
  buffer_after int not null default 15,
  requires_approval boolean not null default false,
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_id text references public.services(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text,
  vehicle_brand text,
  vehicle_line text,
  vehicle_year int,
  vehicle_moves text,
  location text,
  city text,
  symptom text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  block_start timestamptz not null,
  block_end timestamptz not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'completed', 'cancelled')),
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  diagnosis text,
  recommendations text,
  parts_notes text,
  labor_total numeric,
  parts_total numeric,
  grand_total numeric,
  status text not null default 'open' check (status in ('open', 'quoted', 'approved', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null check (type in ('email', 'whatsapp', 'note', 'zapier')),
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound', 'internal')),
  content text,
  created_at timestamptz not null default now()
);

-- Vista cómoda para panel admin / cliente
create or replace view public.appointments_view as
select
  a.*,
  s.name as service_name,
  s.category as service_category,
  s.price_from as service_price,
  concat_ws(' ', a.vehicle_brand, a.vehicle_line, a.vehicle_year::text) as vehicle_summary
from public.appointments a
left join public.services s on s.id = a.service_id;

-- Función para actualizar updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger work_orders_set_updated_at before update on public.work_orders for each row execute function public.set_updated_at();

-- Crea perfil automáticamente al registrarse en Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Helper para saber si el usuario actual es admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- RLS
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.work_orders enable row level security;
alter table public.blocked_times enable row level security;
alter table public.communications enable row level security;

-- Profiles
create policy "profiles_select_self_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_self_or_admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Vehicles
create policy "vehicles_select_owner_or_admin" on public.vehicles for select using (owner_id = auth.uid() or public.is_admin());
create policy "vehicles_insert_owner_or_admin" on public.vehicles for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "vehicles_update_owner_or_admin" on public.vehicles for update using (owner_id = auth.uid() or public.is_admin());

-- Services public readable, admin writable
create policy "services_public_read" on public.services for select using (active = true or public.is_admin());
create policy "services_admin_write" on public.services for all using (public.is_admin()) with check (public.is_admin());

-- Appointments
create policy "appointments_select_owner_or_admin" on public.appointments for select using (client_id = auth.uid() or public.is_admin());
create policy "appointments_insert_client_or_admin" on public.appointments for insert with check (client_id = auth.uid() or public.is_admin() or client_id is null);
create policy "appointments_update_admin_only" on public.appointments for update using (public.is_admin()) with check (public.is_admin());

-- Work orders
create policy "work_orders_select_related_client_or_admin" on public.work_orders for select using (
  public.is_admin() or exists (
    select 1 from public.appointments a where a.id = work_orders.appointment_id and a.client_id = auth.uid()
  )
);
create policy "work_orders_admin_write" on public.work_orders for all using (public.is_admin()) with check (public.is_admin());

-- Blocked times admin only
create policy "blocked_times_admin_all" on public.blocked_times for all using (public.is_admin()) with check (public.is_admin());

-- Communications
create policy "communications_select_related_client_or_admin" on public.communications for select using (
  public.is_admin() or client_id = auth.uid()
);
create policy "communications_insert_admin_or_self" on public.communications for insert with check (public.is_admin() or client_id = auth.uid());
