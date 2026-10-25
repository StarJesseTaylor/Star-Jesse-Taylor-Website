-- Apply after sms_safety.sql. Does not enable alpha or enrol anyone.
begin;
create table if not exists public.sms_unsubscribe_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.sms_global_suppressions (
  phone text primary key,
  stopped_at timestamptz not null default now(),
  reason text not null default 'unsubscribe_link'
);
create table if not exists public.sms_alpha_permissions (
  phone text primary key,
  consent_version text not null,
  consent_at timestamptz not null,
  consent_evidence text not null check (length(consent_evidence)>0),
  paid_verified_until timestamptz not null,
  paid_evidence text not null check (length(paid_evidence)>0)
);
alter table public.sms_unsubscribe_tokens enable row level security;
alter table public.sms_global_suppressions enable row level security;
alter table public.sms_alpha_permissions enable row level security;
revoke all on public.sms_unsubscribe_tokens,public.sms_global_suppressions,public.sms_alpha_permissions from public,anon,authenticated;
grant all on public.sms_unsubscribe_tokens,public.sms_global_suppressions,public.sms_alpha_permissions to service_role;

create or replace function public.sms_alpha_eligible(p_phone text,p_version text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 -- Build scope only. The wire also requires per-country launch approval,
 -- registration evidence where required, and a live alpha price.
 select p_phone ~ '^\+(44|39|30|43|63)' and exists(select 1 from public.sms_alpha_permissions
 where phone=p_phone and consent_version=p_version and consent_at<=now() and paid_verified_until>now())
 and exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 and not exists(select 1 from public.sms_global_suppressions where phone=p_phone)
$$;

create or replace function public.register_sms_unsubscribe(p_phone text,p_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 or exists(select 1 from public.sms_global_suppressions where phone=p_phone) then return false; end if;
 insert into public.sms_unsubscribe_tokens(token_hash,phone) values(p_hash,p_phone) on conflict do nothing;
 return exists(select 1 from public.sms_unsubscribe_tokens where token_hash=p_hash and phone=p_phone);
end $$;

create or replace function public.unsubscribe_sms_token(p_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare target text;
begin
 select phone into target from public.sms_unsubscribe_tokens where token_hash=p_hash;
 if target is null then return false; end if;
 -- Same mutex as reservations: an opt out and a later reservation cannot pass each other.
 perform 1 from public.sms_budget_policy where id=true for update;
 insert into public.sms_global_suppressions(phone) values(target) on conflict do nothing;
 update public.member_channel set status='stopped' where phone=target;
 update public.sms_dispatch_reservations set state='cancelled',error_code='unsubscribe_link'
 where phone=target and channel='sms' and state='reserved';
 -- Keep all charges reserved. An already submitted request cannot be recalled.
 return true;
end $$;

create or replace function public.guard_sms_suppression()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.sms_budget_policy where id=true for update;
 if new.channel='sms' and exists(select 1 from public.sms_global_suppressions where phone=new.phone) then
   raise exception 'SMS globally suppressed';
 end if;
 return new;
end $$;
drop trigger if exists sms_suppression_before_reservation on public.sms_dispatch_reservations;
create trigger sms_suppression_before_reservation before insert on public.sms_dispatch_reservations
for each row execute function public.guard_sms_suppression();

create or replace function public.sms_dispatch_still_allowed(p_key text,p_phone text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.sms_dispatch_reservations where dispatch_key=p_key and phone=p_phone and state='reserved')
 and not exists(select 1 from public.sms_global_suppressions where phone=p_phone)
$$;
create or replace function public.sms_phone_not_suppressed(p_phone text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select not exists(select 1 from public.sms_global_suppressions where phone=p_phone)
$$;
revoke all on function public.sms_phone_not_suppressed(text) from public,anon,authenticated;
grant execute on function public.sms_phone_not_suppressed(text) to service_role;
revoke all on function public.sms_alpha_eligible(text,text),public.register_sms_unsubscribe(text,text),public.unsubscribe_sms_token(text),public.guard_sms_suppression(),public.sms_dispatch_still_allowed(text,text) from public,anon,authenticated;
grant execute on function public.sms_alpha_eligible(text,text),public.register_sms_unsubscribe(text,text),public.unsubscribe_sms_token(text),public.sms_dispatch_still_allowed(text,text) to service_role;
-- Capture the new disclosure without inventing paid membership evidence.
-- Existing verified paid-until values survive a new consent submission.
create or replace function public.record_uk_sms_consent(p_phone text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_phone !~ '^\+44[0-9]{9,10}$' or not exists(
 select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 or exists(select 1 from public.sms_global_suppressions where phone=p_phone) then return false; end if;
 insert into public.sms_alpha_permissions(phone,consent_version,consent_at,consent_evidence,paid_verified_until,paid_evidence)
 values(p_phone,'uk-one-way-2026-10-25',now(),
 'Website /sms separate unchecked consent checkbox with UK one-way disclosure version uk-one-way-2026-10-25',
 '1970-01-01'::timestamptz,'Awaiting membership verification')
 on conflict(phone) do update set consent_version=excluded.consent_version,consent_at=excluded.consent_at,consent_evidence=excluded.consent_evidence;
 return true;
end $$;
revoke all on function public.record_uk_sms_consent(text) from public,anon,authenticated;
grant execute on function public.record_uk_sms_consent(text) to service_role;
commit;
