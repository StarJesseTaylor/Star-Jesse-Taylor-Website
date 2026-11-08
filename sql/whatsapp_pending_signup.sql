-- Requires whatsapp_enrollment_status_guard.sql first. No member changes on apply.
begin;
do $$ begin
 if position('operator_review_required' in pg_get_functiondef('public.wa_confirm(text,text,text,text,text,text)'::regprocedure))=0 then
  raise exception 'Apply WhatsApp enrollment status guard first';
 end if;
end $$;
create table if not exists public.wa_pending_signups (
 code_hash text primary key check(code_hash ~ '^[0-9a-f]{64}$'),
 phone text not null, name text not null, timezone text not null,
 nonce text not null unique, expires_at timestamptz not null,
 consumed_at timestamptz
);
alter table public.wa_pending_signups enable row level security;
revoke all on public.wa_pending_signups from public,anon,authenticated;
create or replace function public.wa_create_pending(p_hash text,p_phone text,p_name text,p_timezone text,p_nonce text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_hash !~ '^[0-9a-f]{64}$' or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_nonce !~ '^[0-9a-f]{32}$'
 or p_name is null or length(p_name)>80 or not exists(select 1 from pg_timezone_names where name=p_timezone) then
  raise exception 'Invalid pending signup';
 end if;
 if exists(select 1 from public.sms_global_suppressions where phone=p_phone)
 or exists(select 1 from public.member_channel where phone=p_phone and status is distinct from 'active') then return false; end if;
 -- Retain expired signup records; confirmation enforces expires_at directly.
 insert into public.wa_pending_signups(code_hash,phone,name,timezone,nonce,expires_at)
 values(p_hash,p_phone,p_name,p_timezone,p_nonce,now()+interval '30 minutes');
 return true;
end $$;
create or replace function public.wa_confirm_pending(p_hash text,p_phone text,p_sid text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare pending public.wa_pending_signups%rowtype; result jsonb;
begin
 if p_sid !~ '^SM[0-9a-fA-F]{32}$' then raise exception 'Invalid message SID'; end if;
 select * into pending from public.wa_pending_signups
 where code_hash=p_hash and phone=p_phone and expires_at>now() for update;
 if not found then return jsonb_build_object('ok',false,'reason','invalid_or_expired_code'); end if;
 if pending.consumed_at is not null then return jsonb_build_object('ok',true,'duplicate',true); end if;
 result=public.wa_confirm(p_phone,pending.timezone,p_sid,'wa-reminders-v1',pending.name,pending.nonce);
 if result->>'ok'='true' then update public.wa_pending_signups set consumed_at=now() where code_hash=p_hash; end if;
 return result;
end $$;
revoke all on function public.wa_create_pending(text,text,text,text,text),public.wa_confirm_pending(text,text,text) from public,anon,authenticated;
grant execute on function public.wa_create_pending(text,text,text,text,text),public.wa_confirm_pending(text,text,text) to service_role;
commit;
