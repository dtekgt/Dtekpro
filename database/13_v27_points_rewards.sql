-- D-TEK GT Web OS v27 — Puntos y canjes
-- Correr después de database/12_v22_loyalty_referrals.sql.
-- Regla inicial: 1 punto por cada Q10 facturados; mínimo 10 puntos por servicio completado.
-- Referido convertido: 100 puntos.

create extension if not exists "pgcrypto";

create table if not exists public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  redemption_id uuid,
  points integer not null check (points <> 0),
  entry_type text not null check (entry_type in ('service_points', 'referral_points', 'redemption', 'refund', 'adjustment')),
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.points_ledger add column if not exists appointment_id uuid references public.appointments(id) on delete set null;
alter table public.points_ledger add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;
alter table public.points_ledger add column if not exists referral_id uuid references public.referrals(id) on delete set null;
alter table public.points_ledger add column if not exists redemption_id uuid;

create unique index if not exists points_one_service_credit
  on public.points_ledger(appointment_id)
  where appointment_id is not null and entry_type = 'service_points';

create unique index if not exists points_one_work_order_credit
  on public.points_ledger(work_order_id)
  where work_order_id is not null and entry_type = 'service_points';

create unique index if not exists points_one_referral_credit
  on public.points_ledger(referral_id)
  where referral_id is not null and entry_type = 'referral_points';

create unique index if not exists points_one_refund_per_redemption
  on public.points_ledger(redemption_id)
  where redemption_id is not null and entry_type = 'refund';

create index if not exists points_ledger_owner_idx on public.points_ledger(owner_id, created_at desc);

create table if not exists public.reward_catalog (
  id text primary key,
  name text not null,
  points_cost integer not null check (points_cost > 0),
  reward_type text not null check (reward_type in ('free_service', 'credit')),
  credit_amount numeric(10,2),
  icon text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null references public.reward_catalog(id),
  points_cost integer not null check (points_cost > 0),
  status text not null default 'requested' check (status in ('requested', 'fulfilled', 'cancelled')),
  notes text,
  fulfilled_by uuid references public.profiles(id) on delete set null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.points_ledger add column if not exists appointment_id uuid references public.appointments(id) on delete set null;
alter table public.points_ledger add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;
alter table public.points_ledger add column if not exists referral_id uuid references public.referrals(id) on delete set null;
alter table public.points_ledger add column if not exists redemption_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'points_ledger_redemption_fk'
  ) then
    alter table public.points_ledger
      add constraint points_ledger_redemption_fk
      foreign key (redemption_id) references public.reward_redemptions(id) on delete set null
      not valid;
  end if;
end $$;

insert into public.reward_catalog (id, name, points_cost, reward_type, credit_amount, icon, sort_order)
values
  ('battery-check', 'Batería y carga', 30, 'free_service', null, '⚡', 10),
  ('brake-check', 'Revisión de frenos', 40, 'free_service', null, '◉', 20),
  ('suspension-check', 'Revisión de suspensión', 40, 'free_service', null, '⌁', 30),
  ('ac-check', 'Revisión de A/C', 50, 'free_service', null, '❄', 40),
  ('scanner-check', 'Escaneo gratis', 60, 'free_service', null, '⌁', 50),
  ('credit-q100', 'Q100 de crédito', 100, 'credit', 100, 'Q', 60)
on conflict (id) do update set
  name = excluded.name,
  points_cost = excluded.points_cost,
  reward_type = excluded.reward_type,
  credit_amount = excluded.credit_amount,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();

drop trigger if exists reward_catalog_set_updated_at on public.reward_catalog;
create trigger reward_catalog_set_updated_at before update on public.reward_catalog
for each row execute function public.set_updated_at();

drop trigger if exists reward_redemptions_set_updated_at on public.reward_redemptions;
create trigger reward_redemptions_set_updated_at before update on public.reward_redemptions
for each row execute function public.set_updated_at();

alter table public.points_ledger enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "points_select_owner_or_admin" on public.points_ledger;
create policy "points_select_owner_or_admin" on public.points_ledger for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "points_admin_write" on public.points_ledger;
create policy "points_admin_write" on public.points_ledger for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rewards_public_read" on public.reward_catalog;
create policy "rewards_public_read" on public.reward_catalog for select
using (active = true or public.is_admin());

drop policy if exists "rewards_admin_write" on public.reward_catalog;
create policy "rewards_admin_write" on public.reward_catalog for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "redemptions_select_owner_or_admin" on public.reward_redemptions;
create policy "redemptions_select_owner_or_admin" on public.reward_redemptions for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "redemptions_admin_write" on public.reward_redemptions;
create policy "redemptions_admin_write" on public.reward_redemptions for all
using (public.is_admin()) with check (public.is_admin());

create or replace function public.dtek_points_balance(p_owner_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::integer from public.points_ledger where owner_id = p_owner_id;
$$;

create or replace function public.dtek_award_completed_appointment_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_service text;
begin
  if new.status <> 'completed' then return new; end if;
  select
    coalesce(new.client_id, (select p.id from public.profiles p where lower(p.email) = lower(new.client_email) order by p.updated_at desc limit 1)),
    coalesce((select s.name from public.services s where s.id = new.service_id), 'Servicio D-TEK')
  into v_owner, v_service;
  if v_owner is null then return new; end if;

  insert into public.points_ledger (owner_id, appointment_id, points, entry_type, description)
  values (v_owner, new.id, 10, 'service_points', v_service)
  on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
  do update set owner_id = excluded.owner_id, description = excluded.description;
  return new;
end;
$$;

drop trigger if exists appointment_award_points on public.appointments;
create trigger appointment_award_points
after insert or update of status, client_id on public.appointments
for each row execute function public.dtek_award_completed_appointment_points();

create or replace function public.dtek_award_service_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_service text;
  v_total numeric;
  v_points integer;
  v_appointment uuid;
begin
  if new.status <> 'completed' then return new; end if;

  select a.id, coalesce(a.client_id, p.id), coalesce(s.name, 'Servicio D-TEK')
  into v_appointment, v_owner, v_service
  from public.appointments a
  left join public.profiles p on lower(p.email) = lower(a.client_email)
  left join public.services s on s.id = a.service_id
  where a.id = new.appointment_id
  limit 1;

  if v_owner is null or v_appointment is null then return new; end if;
  v_total := coalesce(new.grand_total, coalesce(new.labor_total,0) + coalesce(new.parts_total,0), 0);
  v_points := greatest(10, floor(v_total / 10)::integer);

  insert into public.points_ledger (owner_id, appointment_id, work_order_id, points, entry_type, description)
  values (v_owner, v_appointment, new.id, v_points, 'service_points', v_service)
  on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
  do update set owner_id = excluded.owner_id, work_order_id = excluded.work_order_id, points = excluded.points, description = excluded.description;
  return new;
end;
$$;

drop trigger if exists work_order_award_points on public.work_orders;
create trigger work_order_award_points
after insert or update of status, grand_total, labor_total, parts_total on public.work_orders
for each row execute function public.dtek_award_service_points();

create or replace function public.dtek_award_referral_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'converted' and new.referrer_id is not null then
    insert into public.points_ledger (owner_id, referral_id, points, entry_type, description)
    values (new.referrer_id, new.id, 100, 'referral_points', 'Recomendación: ' || new.referred_name)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists referral_award_points on public.referrals;
create trigger referral_award_points
after insert or update of status, referrer_id on public.referrals
for each row execute function public.dtek_award_referral_points();

-- Reconocer referidos ya convertidos.
insert into public.points_ledger (owner_id, referral_id, points, entry_type, description)
select r.referrer_id, r.id, 100, 'referral_points', 'Recomendación: ' || r.referred_name
from public.referrals r
where r.status = 'converted' and r.referrer_id is not null
on conflict do nothing;

-- Reconocer citas ya completadas, incluso si todavía no tienen reporte técnico.
insert into public.points_ledger (owner_id, appointment_id, points, entry_type, description)
select coalesce(a.client_id, p.id), a.id, 10, 'service_points', coalesce(s.name, 'Servicio D-TEK')
from public.appointments a
left join public.profiles p on lower(p.email) = lower(a.client_email)
left join public.services s on s.id = a.service_id
where a.status = 'completed' and coalesce(a.client_id, p.id) is not null
on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
do nothing;

-- Reconocer órdenes ya completadas asociadas a una cuenta.
insert into public.points_ledger (owner_id, appointment_id, work_order_id, points, entry_type, description)
select
  coalesce(a.client_id, p.id),
  a.id,
  wo.id,
  greatest(10, floor(coalesce(wo.grand_total, coalesce(wo.labor_total,0) + coalesce(wo.parts_total,0), 0) / 10)::integer),
  'service_points',
  coalesce(s.name, 'Servicio D-TEK')
from public.work_orders wo
join public.appointments a on a.id = wo.appointment_id
left join public.profiles p on lower(p.email) = lower(a.client_email)
left join public.services s on s.id = a.service_id
where wo.status = 'completed' and coalesce(a.client_id, p.id) is not null
on conflict (appointment_id) where appointment_id is not null and entry_type = 'service_points'
do update set work_order_id = excluded.work_order_id, points = excluded.points, description = excluded.description;

create or replace function public.dtek_client_get_points_summary()
returns table (
  points_balance integer,
  points_earned integer,
  points_used integer,
  service_points integer,
  referral_points integer,
  redemptions_pending bigint,
  referrals_total bigint,
  referrals_converted bigint,
  referrals_pending bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(l.points), 0)::integer,
    coalesce(sum(l.points) filter (where l.points > 0), 0)::integer,
    abs(coalesce(sum(l.points) filter (where l.points < 0), 0))::integer,
    coalesce(sum(l.points) filter (where l.entry_type = 'service_points'), 0)::integer,
    coalesce(sum(l.points) filter (where l.entry_type = 'referral_points'), 0)::integer,
    (select count(*) from public.reward_redemptions rr where rr.owner_id = auth.uid() and rr.status = 'requested'),
    (select count(*) from public.referrals r where r.referrer_id = auth.uid()),
    (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status = 'converted'),
    (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status in ('submitted','contacted','scheduled'))
  from public.points_ledger l
  where l.owner_id = auth.uid();
$$;

create or replace function public.dtek_client_list_rewards()
returns table (
  id text,
  name text,
  points_cost integer,
  reward_type text,
  credit_amount numeric,
  icon text,
  can_redeem boolean
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.name, r.points_cost, r.reward_type, r.credit_amount, r.icon,
    public.dtek_points_balance(auth.uid()) >= r.points_cost
  from public.reward_catalog r
  where auth.uid() is not null and r.active = true
  order by r.sort_order, r.points_cost;
$$;

create or replace function public.dtek_client_list_points_activity(p_limit integer default 12)
returns table (id uuid, points integer, entry_type text, description text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select l.id, l.points, l.entry_type, l.description, l.created_at
  from public.points_ledger l
  where l.owner_id = auth.uid()
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit,12),50));
$$;

create or replace function public.dtek_client_list_redemptions()
returns table (id uuid, reward_id text, reward_name text, points_cost integer, status text, notes text, created_at timestamptz, fulfilled_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select rr.id, rr.reward_id, rc.name, rr.points_cost, rr.status, rr.notes, rr.created_at, rr.fulfilled_at
  from public.reward_redemptions rr
  join public.reward_catalog rc on rc.id = rr.reward_id
  where rr.owner_id = auth.uid()
  order by rr.created_at desc;
$$;

create or replace function public.dtek_client_redeem_reward(p_reward_id text)
returns setof public.reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.reward_catalog;
  v_redemption public.reward_redemptions;
  v_balance integer;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión'; end if;
  select * into v_reward from public.reward_catalog where id = p_reward_id and active = true;
  if v_reward.id is null then raise exception 'Premio no disponible'; end if;
  v_balance := public.dtek_points_balance(auth.uid());
  if v_balance < v_reward.points_cost then raise exception 'Todavía no tenés suficientes puntos'; end if;

  insert into public.reward_redemptions (owner_id, reward_id, points_cost)
  values (auth.uid(), v_reward.id, v_reward.points_cost)
  returning * into v_redemption;

  insert into public.points_ledger (owner_id, redemption_id, points, entry_type, description)
  values (auth.uid(), v_redemption.id, -v_reward.points_cost, 'redemption', 'Canje: ' || v_reward.name);

  return query select * from public.reward_redemptions where id = v_redemption.id;
end;
$$;

create or replace function public.dtek_admin_list_redemptions()
returns table (id uuid, owner_id uuid, client_name text, client_email text, client_phone text, reward_id text, reward_name text, points_cost integer, status text, notes text, created_at timestamptz, fulfilled_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  return query
  select rr.id, rr.owner_id, coalesce(p.full_name,'Cliente'), p.email, p.phone, rr.reward_id, rc.name, rr.points_cost, rr.status, rr.notes, rr.created_at, rr.fulfilled_at
  from public.reward_redemptions rr
  join public.reward_catalog rc on rc.id = rr.reward_id
  left join public.profiles p on p.id = rr.owner_id
  order by case rr.status when 'requested' then 1 when 'fulfilled' then 2 else 3 end, rr.created_at desc;
end;
$$;

create or replace function public.dtek_admin_update_redemption_status(p_redemption_id uuid, p_status text, p_notes text default null)
returns setof public.reward_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.reward_redemptions;
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  if p_status not in ('requested','fulfilled','cancelled') then raise exception 'Estado inválido'; end if;
  select * into v_item from public.reward_redemptions where id = p_redemption_id;
  if v_item.id is null then raise exception 'Canje no encontrado'; end if;

  if p_status = 'cancelled' and v_item.status <> 'cancelled' then
    insert into public.points_ledger (owner_id, redemption_id, points, entry_type, description, created_by)
    values (v_item.owner_id, v_item.id, v_item.points_cost, 'refund', 'Puntos devueltos por canje cancelado', auth.uid())
    on conflict do nothing;
  end if;

  update public.reward_redemptions
  set status = p_status,
      notes = nullif(trim(coalesce(p_notes,'')),''),
      fulfilled_by = case when p_status = 'fulfilled' then auth.uid() else fulfilled_by end,
      fulfilled_at = case when p_status = 'fulfilled' then now() else fulfilled_at end,
      updated_at = now()
  where id = p_redemption_id
  returning * into v_item;

  return query select * from public.reward_redemptions where id = v_item.id;
end;
$$;

create or replace function public.dtek_admin_adjust_points(p_owner_id uuid, p_points integer, p_description text)
returns setof public.points_ledger
language plpgsql
security definer
set search_path = public
as $$
declare v_entry public.points_ledger;
begin
  if not public.is_admin() then raise exception 'Solo admin'; end if;
  if coalesce(p_points,0) = 0 then raise exception 'El ajuste no puede ser cero'; end if;
  insert into public.points_ledger (owner_id, points, entry_type, description, created_by)
  values (p_owner_id, p_points, 'adjustment', coalesce(nullif(trim(p_description),''),'Ajuste D-TEK'), auth.uid())
  returning * into v_entry;
  return query select * from public.points_ledger where id = v_entry.id;
end;
$$;

grant execute on function public.dtek_client_get_points_summary() to authenticated;
grant execute on function public.dtek_client_list_rewards() to authenticated;
grant execute on function public.dtek_client_list_points_activity(integer) to authenticated;
grant execute on function public.dtek_client_list_redemptions() to authenticated;
grant execute on function public.dtek_client_redeem_reward(text) to authenticated;
grant execute on function public.dtek_admin_list_redemptions() to authenticated;
grant execute on function public.dtek_admin_update_redemption_status(uuid,text,text) to authenticated;
grant execute on function public.dtek_admin_adjust_points(uuid,integer,text) to authenticated;

revoke all on function public.dtek_points_balance(uuid) from public, anon, authenticated;
