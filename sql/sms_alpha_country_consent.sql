-- Country-specific disclosure recording; never grants paid access.
begin;
create or replace function public.record_alpha_sms_consent(p_phone text,p_version text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare expected text;
begin
 expected := case when p_phone ~ '^\+44[0-9]{9,10}$' then 'uk-one-way-2026-10-25'
 when p_phone ~ '^\+39[0-9]{6,12}$' then 'it-one-way-2026-10-25'
 when p_phone ~ '^\+30[0-9]{10}$' then 'gr-one-way-2026-10-25'
 when p_phone ~ '^\+43[0-9]{7,13}$' then 'at-one-way-2026-10-25' else null end;
 if expected is null or p_version is distinct from expected then return false; end if;
 if not exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 or exists(select 1 from public.sms_global_suppressions where phone=p_phone) then return false; end if;
 insert into public.sms_alpha_permissions(phone,consent_version,consent_at,consent_evidence,paid_verified_until,paid_evidence)
 values(p_phone,p_version,now(),'Website /sms separate unchecked consent checkbox with one-way disclosure version ' || p_version,'1970-01-01'::timestamptz,'Awaiting membership verification')
 on conflict(phone) do update set consent_version=excluded.consent_version,consent_at=excluded.consent_at,consent_evidence=excluded.consent_evidence;
 return true;
end $$;
revoke all on function public.record_alpha_sms_consent(text,text) from public,anon,authenticated;
grant execute on function public.record_alpha_sms_consent(text,text) to service_role;
commit;
