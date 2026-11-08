-- Apply after whatsapp_reminders.sql. Function change only; no member changes.
begin;
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

commit;
