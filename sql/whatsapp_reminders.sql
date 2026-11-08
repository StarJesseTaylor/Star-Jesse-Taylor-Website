-- Additive WhatsApp integration. Does not enroll anybody or change budget caps.
begin;
create table if not exists public.wa_consent (
 phone text primary key, consent_at timestamptz not null, version text not null,
 revoked_at timestamptz, timezone text not null
);
create table if not exists public.wa_inbound_events (
 provider_sid text primary key, phone text not null, event text not null, nonce text unique,
 created_at timestamptz not null default now()
);
alter table public.wa_consent enable row level security;
alter table public.wa_inbound_events enable row level security;
revoke all on public.wa_consent,public.wa_inbound_events from public,anon,authenticated;
grant all on public.wa_consent,public.wa_inbound_events to service_role;

create or replace function public.wa_has_consent(p_phone text) returns boolean
language sql security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.wa_consent c join public.member_channel m on m.phone=c.phone
 where c.phone=p_phone and c.revoked_at is null and c.version='wa-reminders-v1'
 and m.channel='whatsapp' and m.status='active' and m.consent_at is not null)
 and not exists(select 1 from public.sms_global_suppressions where phone=p_phone);
$$;

create or replace function public.wa_confirm(p_phone text,p_timezone text,p_sid text,p_version text,p_name text,p_nonce text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare mid uuid;
begin
 if p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_sid !~ '^SM[0-9a-fA-F]{32}$' or p_version<>'wa-reminders-v1' or p_nonce !~ '^[0-9a-f]{32}$'
 or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid confirmation'; end if;
 perform 1 from public.sms_budget_policy where id=true for update;
 if exists(select 1 from public.wa_inbound_events where provider_sid=p_sid or nonce=p_nonce) then return jsonb_build_object('ok',true,'duplicate',true); end if;
 if exists(select 1 from public.sms_global_suppressions where phone=p_phone) then return jsonb_build_object('ok',false,'reason','suppressed'); end if;
 -- A new web signup/WhatsApp JOIN must never undo an operator hold or opt-out.
 perform 1 from public.member_channel where phone=p_phone for update;
 if exists(select 1 from public.member_channel where phone=p_phone and status is distinct from 'active') then
   return jsonb_build_object('ok',false,'reason','operator_review_required');
 end if;
 insert into public.wa_inbound_events(provider_sid,phone,event,nonce) values(p_sid,p_phone,'consent',p_nonce);
 insert into public.member_channel(phone,first_name,channel,timezone,consent_at,consent_source,status)
 values(p_phone,left(p_name,80),'whatsapp',p_timezone,now(),'whatsapp-confirmed-v1','active')
 on conflict(phone) do update set channel='whatsapp',timezone=excluded.timezone,updated_at=now()
 where member_channel.status='active'
 returning id into mid;
 if mid is null then raise exception 'Enrollment requires operator review'; end if;
 insert into public.wa_consent(phone,consent_at,version,timezone,revoked_at)
 values(p_phone,now(),p_version,p_timezone,null)
 on conflict(phone) do update set consent_at=excluded.consent_at,version=excluded.version,timezone=excluded.timezone,revoked_at=null;
 if not exists(select 1 from public.message_prefs where member_id=mid and type='reminder') then
 insert into public.message_prefs(member_id,type,enabled,frequency,mode,window_start,window_end)
 values(mid,'reminder',true,1,'random',8,21);
 else update public.message_prefs set enabled=true,frequency=1,window_start=8,window_end=21 where member_id=mid and type='reminder'; end if;
 -- Cancel an old-channel send that has reserved but has not reached the provider.
 update public.sms_dispatch_reservations set state='cancelled_channel_switch'
 where phone=p_phone and channel='sms' and state='reserved';
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.wa_stop(p_phone text,p_sid text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.sms_budget_policy where id=true for update;
 if exists(select 1 from public.wa_inbound_events where provider_sid=p_sid) then return true; end if;
 insert into public.wa_inbound_events(provider_sid,phone,event) values(p_sid,p_phone,'stop');
 update public.wa_consent set revoked_at=now() where phone=p_phone;
 update public.member_channel set status='stopped',updated_at=now() where phone=p_phone and channel='whatsapp';
 update public.sms_dispatch_reservations set state='cancelled_preflight' where phone=p_phone and channel='whatsapp' and state='reserved';
 return true;
end $$;

-- Covers a stale scheduler snapshot after a channel switch, under the existing budget lock.
create or replace function public.guard_reminder_channel() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.kind<>'reply' and exists(select 1 from public.wa_consent where phone=new.phone) then
   if not exists(select 1 from public.member_channel where phone=new.phone and channel=new.channel and status='active') then raise exception 'Channel changed'; end if;
 end if;
 if new.channel='whatsapp' and new.kind<>'reply' and not public.wa_has_consent(new.phone) then raise exception 'WhatsApp consent required'; end if;
 return new;
end $$;
drop trigger if exists guard_reminder_channel on public.sms_dispatch_reservations;
create trigger guard_reminder_channel before insert on public.sms_dispatch_reservations
for each row execute function public.guard_reminder_channel();
revoke all on function public.wa_has_consent(text),public.wa_confirm(text,text,text,text,text,text),public.wa_stop(text,text),public.guard_reminder_channel() from public,anon,authenticated;
grant execute on function public.wa_has_consent(text),public.wa_confirm(text,text,text,text,text,text),public.wa_stop(text,text),public.guard_reminder_channel() to service_role;
commit;
