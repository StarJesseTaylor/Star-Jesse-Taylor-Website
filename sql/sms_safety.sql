-- Atomic outgoing-message reservations. Amounts are USD microdollars.
-- Star approved $5/day and $50/month on 2026-10-24.
-- America/Los_Angeles accounting periods. Retain reservations after any uncertain outcome.
begin;
create table if not exists public.sms_budget_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  daily_micro bigint not null check (daily_micro > 0),
  monthly_micro bigint not null check (monthly_micro > 0)
);
insert into public.sms_budget_policy(id,daily_micro,monthly_micro)
values(true,5000000,50000000) on conflict (id) do nothing;

create table if not exists public.sms_dispatch_reservations (
  dispatch_key text primary key,
  phone text not null,
  sender text not null,
  channel text not null,
  kind text not null,
  reserved_micro bigint not null check (reserved_micro > 0),
  created_at timestamptz not null default now(),
  state text not null default 'reserved',
  provider_sid text,
  error_code text
);
create index if not exists sms_dispatch_created on public.sms_dispatch_reservations(created_at);
create index if not exists sms_dispatch_phone on public.sms_dispatch_reservations(phone,created_at);

create table if not exists public.sms_route_holds (
  phone text not null,
  sender text not null,
  channel text not null,
  error_code text not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(phone,sender,channel)
);
alter table public.sms_route_holds add column if not exists released_at timestamptz;

alter table public.sms_budget_policy enable row level security;
alter table public.sms_dispatch_reservations enable row level security;
alter table public.sms_route_holds enable row level security;
revoke all on public.sms_budget_policy, public.sms_dispatch_reservations, public.sms_route_holds from anon, authenticated;
grant all on public.sms_budget_policy, public.sms_dispatch_reservations, public.sms_route_holds to service_role;

create or replace function public.reserve_sms_dispatch(
  p_key text, p_phone text, p_sender text, p_channel text,
  p_kind text, p_micro bigint
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy public.sms_budget_policy%rowtype;
  day_start timestamptz := date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  day_used bigint;
  month_used bigint;
begin
  if p_key is null or length(p_key)<3 or p_phone is null or p_sender is null
    or p_channel not in ('sms','whatsapp') or p_kind not in ('reminder','welcome','reply')
    or p_micro is null or p_micro<=0 then
    return jsonb_build_object('allow',false,'reason','invalid_reservation');
  end if;
  -- Every request locks the SAME policy row, not one lock per recipient.
  select * into policy from public.sms_budget_policy where id=true for update;
  if not found or not policy.enabled then
    return jsonb_build_object('allow',false,'reason','budget_disabled');
  end if;
  if exists(select 1 from public.sms_dispatch_reservations where dispatch_key=p_key) then
    return jsonb_build_object('allow',false,'reason','duplicate');
  end if;
  if exists(select 1 from public.sms_route_holds
    where phone in (p_phone,'*') and sender=p_sender and channel=p_channel and released_at is null) then
    return jsonb_build_object('allow',false,'reason','route_held');
  end if;
  if p_kind<>'reply' and not exists(select 1 from public.member_channel where phone=p_phone
    and status='active' and consent_at is not null) then
    return jsonb_build_object('allow',false,'reason','no_active_consent');
  end if;
  if exists(select 1 from public.sms_dispatch_reservations where phone=p_phone
    and channel=p_channel and state in ('reserved','unknown')
    and created_at<now()-interval '1 minute') then
    return jsonb_build_object('allow',false,'reason','previous_outcome_needs_reconciliation');
  end if;
  if p_kind='welcome' and exists(select 1 from public.sms_dispatch_reservations
    where phone=p_phone and kind='welcome') then
    return jsonb_build_object('allow',false,'reason','welcome_already_reserved');
  end if;
  if p_kind='reply' and exists(select 1 from public.sms_dispatch_reservations
    where phone=p_phone and kind='reply' and created_at>now()-interval '1 hour') then
    return jsonb_build_object('allow',false,'reason','phone_reply_limit');
  end if;
  if p_kind<>'reply' and (select count(*) from public.sms_dispatch_reservations
    where phone=p_phone and kind<>'reply' and created_at>now()-interval '24 hours')>=2 then
    return jsonb_build_object('allow',false,'reason','phone_daily_limit');
  end if;
  select coalesce(sum(reserved_micro) filter(where created_at>=day_start),0),
    coalesce(sum(reserved_micro),0) into day_used,month_used
    from public.sms_dispatch_reservations where created_at>=month_start;
  if day_used+p_micro>policy.daily_micro or month_used+p_micro>policy.monthly_micro then
    return jsonb_build_object('allow',false,'reason','budget_limit',
      'day_reserved_micro',day_used,'month_reserved_micro',month_used);
  end if;
  insert into public.sms_dispatch_reservations
    (dispatch_key,phone,sender,channel,kind,reserved_micro)
    values(p_key,p_phone,p_sender,p_channel,p_kind,p_micro);
  return jsonb_build_object('allow',true,'key',p_key,'reserved_micro',p_micro);
end;
$$;
revoke all on function public.reserve_sms_dispatch(text,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_sms_dispatch(text,text,text,text,text,bigint) to service_role;
create or replace function public.sms_safety_version() returns text
language sql stable security invoker set search_path=public,pg_temp
as $$ select '2026-10-24-v2'::text $$;
revoke all on function public.sms_safety_version() from public,anon,authenticated;
grant execute on function public.sms_safety_version() to service_role;
commit;

