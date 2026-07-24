-- D-TEK GT Web OS v22 — Pecera: referidos + Saldo D-TEK
-- Correr después de database/11_v21_vehicle_living_profile.sql.
-- Regla inicial: cada referido convertido en trabajo acredita Q100.

create extension if not exists "pgcrypto";

create or replace function public.dtek_digits(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles(id) on delete set null,
  referrer_name text not null,
  referrer_phone text not null,
  referred_name text not null,
  referred_phone text not null,
  referred_vehicle text,
  notes text,
  source text not null default 'web-referral',
  status text not null default 'submitted' check (status in ('submitted', 'contacted', 'scheduled', 'converted', 'discarded')),
  reward_amount numeric(10,2) not null default 100,
  credit_status text not null default 'pending' check (credit_status in ('pending', 'credited', 'not_eligible')),
  converted_appointment_id uuid references public.appointments(id) on delete set null,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  amount numeric(10,2) not null,
  entry_type text not null check (entry_type in ('referral_credit', 'redemption', 'adjustment')),
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists loyalty_one_credit_per_referral
  on public.loyalty_ledger(referral_id)
  where referral_id is not null and entry_type = 'referral_credit';

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
create index if not exists referrals_status_idx on public.referrals(status);
create index if not exists referrals_referrer_phone_digits_idx on public.referrals((public.dtek_digits(referrer_phone)));
create index if not exists loyalty_ledger_owner_idx on public.loyalty_ledger(owner_id, created_at desc);

drop trigger if exists referrals_set_updated_at on public.referrals;
create trigger referrals_set_updated_at
before update on public.referrals
for each row execute function public.set_updated_at();

alter table public.referrals enable row level security;
alter table public.loyalty_ledger enable row level security;

drop policy if exists "referrals_select_owner_or_admin" on public.referrals;
create policy "referrals_select_owner_or_admin"
on public.referrals for select
using (referrer_id = auth.uid() or public.is_admin());

drop policy if exists "referrals_admin_update" on public.referrals;
create policy "referrals_admin_update"
on public.referrals for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "loyalty_select_owner_or_admin" on public.loyalty_ledger;
create policy "loyalty_select_owner_or_admin"
on public.loyalty_ledger for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "loyalty_admin_write" on public.loyalty_ledger;
create policy "loyalty_admin_write"
on public.loyalty_ledger for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.dtek_public_create_referral(
  p_referrer_name text,
  p_referrer_phone text,
  p_referred_name text,
  p_referred_phone text,
  p_referred_vehicle text default null,
  p_notes text default null,
  p_source text default 'public-referral'
)
returns table (
  id uuid,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals;
begin
  if length(trim(coalesce(p_referrer_name, ''))) < 2 then
    raise exception 'Escribí tu nombre';
  end if;
  if length(public.dtek_digits(p_referrer_phone)) < 8 then
    raise exception 'Escribí un WhatsApp válido';
  end if;
  if length(trim(coalesce(p_referred_name, ''))) < 2 then
    raise exception 'Escribí el nombre de la persona recomendada';
  end if;
  if length(public.dtek_digits(p_referred_phone)) < 8 then
    raise exception 'Escribí el WhatsApp de la persona recomendada';
  end if;
  if public.dtek_digits(p_referrer_phone) = public.dtek_digits(p_referred_phone) then
    raise exception 'El contacto recomendado debe ser diferente al tuyo';
  end if;
  if exists (
    select 1 from public.referrals r
    where public.dtek_digits(r.referrer_phone) = public.dtek_digits(p_referrer_phone)
      and public.dtek_digits(r.referred_phone) = public.dtek_digits(p_referred_phone)
      and r.status <> 'discarded'
  ) then
    raise exception 'Esta recomendación ya está registrada';
  end if;

  insert into public.referrals (
    referrer_id,
    referrer_name,
    referrer_phone,
    referred_name,
    referred_phone,
    referred_vehicle,
    notes,
    source
  ) values (
    null,
    trim(p_referrer_name),
    trim(p_referrer_phone),
    trim(p_referred_name),
    trim(p_referred_phone),
    nullif(trim(coalesce(p_referred_vehicle, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(nullif(trim(p_source), ''), 'public-referral')
  ) returning * into v_referral;

  return query select v_referral.id, v_referral.status, v_referral.created_at;
end;
$$;

create or replace function public.dtek_client_create_referral(
  p_referred_name text,
  p_referred_phone text,
  p_referred_vehicle text default null,
  p_notes text default null
)
returns setof public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_referral public.referrals;
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  if length(public.dtek_digits(v_profile.phone)) < 8 then
    raise exception 'Agregá tu WhatsApp en Perfil antes de recomendar';
  end if;
  if length(trim(coalesce(p_referred_name, ''))) < 2 then
    raise exception 'Escribí el nombre de la persona recomendada';
  end if;
  if length(public.dtek_digits(p_referred_phone)) < 8 then
    raise exception 'Escribí un WhatsApp válido para la persona recomendada';
  end if;
  if public.dtek_digits(v_profile.phone) = public.dtek_digits(p_referred_phone) then
    raise exception 'El contacto recomendado debe ser diferente al tuyo';
  end if;
  if exists (
    select 1 from public.referrals r
    where public.dtek_digits(r.referrer_phone) = public.dtek_digits(v_profile.phone)
      and public.dtek_digits(r.referred_phone) = public.dtek_digits(p_referred_phone)
      and r.status <> 'discarded'
  ) then
    raise exception 'Esta recomendación ya está registrada';
  end if;

  insert into public.referrals (
    referrer_id,
    referrer_name,
    referrer_phone,
    referred_name,
    referred_phone,
    referred_vehicle,
    notes,
    source
  ) values (
    v_profile.id,
    coalesce(nullif(trim(v_profile.full_name), ''), v_profile.email, 'Cliente D-TEK'),
    v_profile.phone,
    trim(p_referred_name),
    trim(p_referred_phone),
    nullif(trim(coalesce(p_referred_vehicle, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'mi-dtek'
  ) returning * into v_referral;

  return query select * from public.referrals where id = v_referral.id;
end;
$$;

create or replace function public.dtek_client_claim_referrals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_claimed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or length(public.dtek_digits(v_profile.phone)) < 8 then
    return 0;
  end if;

  update public.referrals
  set referrer_id = v_profile.id,
      referrer_name = coalesce(nullif(trim(v_profile.full_name), ''), referrer_name),
      updated_at = now()
  where referrer_id is null
    and public.dtek_digits(referrer_phone) = public.dtek_digits(v_profile.phone);

  get diagnostics v_claimed = row_count;

  insert into public.loyalty_ledger (owner_id, referral_id, amount, entry_type, description, created_by)
  select
    v_profile.id,
    r.id,
    r.reward_amount,
    'referral_credit',
    'Saldo por recomendación convertida: ' || r.referred_name,
    null
  from public.referrals r
  where r.referrer_id = v_profile.id
    and r.status = 'converted'
    and not exists (
      select 1 from public.loyalty_ledger l
      where l.referral_id = r.id and l.entry_type = 'referral_credit'
    )
  on conflict do nothing;

  update public.referrals r
  set credit_status = 'credited',
      credited_at = coalesce(r.credited_at, now()),
      updated_at = now()
  where r.referrer_id = v_profile.id
    and r.status = 'converted'
    and exists (
      select 1 from public.loyalty_ledger l
      where l.referral_id = r.id and l.entry_type = 'referral_credit'
    );

  return v_claimed;
end;
$$;

create or replace function public.dtek_client_list_referrals()
returns table (
  id uuid,
  referred_name text,
  referred_phone text,
  referred_vehicle text,
  status text,
  reward_amount numeric,
  credit_status text,
  created_at timestamptz,
  credited_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.referred_name,
    r.referred_phone,
    r.referred_vehicle,
    r.status,
    r.reward_amount,
    r.credit_status,
    r.created_at,
    r.credited_at
  from public.referrals r
  where r.referrer_id = auth.uid()
  order by r.created_at desc;
$$;

create or replace function public.dtek_client_get_loyalty_summary()
returns table (
  balance numeric,
  earned numeric,
  used numeric,
  referrals_total bigint,
  referrals_converted bigint,
  referrals_pending bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((select sum(l.amount) from public.loyalty_ledger l where l.owner_id = auth.uid()), 0)::numeric as balance,
    coalesce((select sum(l.amount) from public.loyalty_ledger l where l.owner_id = auth.uid() and l.amount > 0), 0)::numeric as earned,
    abs(coalesce((select sum(l.amount) from public.loyalty_ledger l where l.owner_id = auth.uid() and l.amount < 0), 0))::numeric as used,
    (select count(*) from public.referrals r where r.referrer_id = auth.uid()) as referrals_total,
    (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status = 'converted') as referrals_converted,
    (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status in ('submitted', 'contacted', 'scheduled')) as referrals_pending;
$$;

create or replace function public.dtek_admin_list_referrals()
returns table (
  id uuid,
  referrer_id uuid,
  referrer_name text,
  referrer_phone text,
  referrer_email text,
  referred_name text,
  referred_phone text,
  referred_vehicle text,
  notes text,
  source text,
  status text,
  reward_amount numeric,
  credit_status text,
  converted_appointment_id uuid,
  credited_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede ver referidos';
  end if;

  return query
  select
    r.id,
    r.referrer_id,
    r.referrer_name,
    r.referrer_phone,
    p.email,
    r.referred_name,
    r.referred_phone,
    r.referred_vehicle,
    r.notes,
    r.source,
    r.status,
    r.reward_amount,
    r.credit_status,
    r.converted_appointment_id,
    r.credited_at,
    r.created_at,
    r.updated_at
  from public.referrals r
  left join public.profiles p on p.id = r.referrer_id
  order by
    case r.status when 'submitted' then 1 when 'contacted' then 2 when 'scheduled' then 3 when 'converted' then 4 else 5 end,
    r.created_at desc;
end;
$$;

create or replace function public.dtek_admin_update_referral_status(
  p_referral_id uuid,
  p_status text,
  p_reward_amount numeric default 100,
  p_converted_appointment_id uuid default null
)
returns setof public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals;
  v_owner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede actualizar referidos';
  end if;
  if p_status not in ('submitted', 'contacted', 'scheduled', 'converted', 'discarded') then
    raise exception 'Estado de referido inválido';
  end if;
  if coalesce(p_reward_amount, 0) < 0 then
    raise exception 'El saldo no puede ser negativo';
  end if;

  select * into v_referral from public.referrals where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'Referido no encontrado';
  end if;
  if v_referral.credit_status = 'credited' and p_status <> 'converted' then
    raise exception 'Este referido ya generó saldo; no se puede quitar desde este botón';
  end if;

  v_owner_id := v_referral.referrer_id;
  if p_status = 'converted' and v_owner_id is null then
    select p.id into v_owner_id
    from public.profiles p
    where public.dtek_digits(p.phone) = public.dtek_digits(v_referral.referrer_phone)
    order by p.updated_at desc
    limit 1;
  end if;

  update public.referrals
  set status = p_status,
      reward_amount = coalesce(p_reward_amount, reward_amount),
      converted_appointment_id = coalesce(p_converted_appointment_id, converted_appointment_id),
      referrer_id = coalesce(v_owner_id, referrer_id),
      credit_status = case
        when p_status = 'discarded' and credit_status <> 'credited' then 'not_eligible'
        when p_status = 'converted' and v_owner_id is null then 'pending'
        else credit_status
      end,
      updated_at = now()
  where id = p_referral_id
  returning * into v_referral;

  if p_status = 'converted' and v_owner_id is not null then
    insert into public.loyalty_ledger (owner_id, referral_id, amount, entry_type, description, created_by)
    values (
      v_owner_id,
      v_referral.id,
      v_referral.reward_amount,
      'referral_credit',
      'Saldo por recomendación convertida: ' || v_referral.referred_name,
      auth.uid()
    )
    on conflict do nothing;

    update public.referrals
    set credit_status = 'credited',
        credited_at = coalesce(credited_at, now()),
        updated_at = now()
    where id = v_referral.id
    returning * into v_referral;
  end if;

  return query select * from public.referrals where id = v_referral.id;
end;
$$;

create or replace function public.dtek_admin_adjust_loyalty(
  p_owner_id uuid,
  p_amount numeric,
  p_description text
)
returns setof public.loyalty_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.loyalty_ledger;
begin
  if not public.is_admin() then
    raise exception 'Solo admin puede ajustar saldo';
  end if;
  if coalesce(p_amount, 0) = 0 then
    raise exception 'El ajuste no puede ser cero';
  end if;
  if not exists (select 1 from public.profiles where id = p_owner_id) then
    raise exception 'Cliente no encontrado';
  end if;

  insert into public.loyalty_ledger (owner_id, amount, entry_type, description, created_by)
  values (
    p_owner_id,
    p_amount,
    case when p_amount < 0 then 'redemption' else 'adjustment' end,
    coalesce(nullif(trim(p_description), ''), 'Ajuste manual D-TEK'),
    auth.uid()
  ) returning * into v_entry;

  return query select * from public.loyalty_ledger where id = v_entry.id;
end;
$$;

grant execute on function public.dtek_public_create_referral(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.dtek_client_create_referral(text, text, text, text) to authenticated;
grant execute on function public.dtek_client_claim_referrals() to authenticated;
grant execute on function public.dtek_client_list_referrals() to authenticated;
grant execute on function public.dtek_client_get_loyalty_summary() to authenticated;
grant execute on function public.dtek_admin_list_referrals() to authenticated;
grant execute on function public.dtek_admin_update_referral_status(uuid, text, numeric, uuid) to authenticated;
grant execute on function public.dtek_admin_adjust_loyalty(uuid, numeric, text) to authenticated;
