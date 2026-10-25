-- 25 Oct 2026 member-country expansion for one-way SMS routes.
-- Apply AFTER sms_alpha_unsubscribe.sql and sms_alpha_country_consent.sql.
-- Records country-specific one-way disclosure only. Never grants paid access:
-- paid_verified_until stays at the 1970 placeholder until membership is verified.
-- Enables nothing: sending still requires per-country env launch flags.
begin;
create or replace function public.record_alpha_sms_consent(p_phone text,p_version text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare expected text;
begin
 expected := case
  when p_phone ~ '^\+355[0-9]{8,9}$'  then 'al-one-way-2026-10-25'
  when p_phone ~ '^\+382[0-9]{8}$'    then 'me-one-way-2026-10-25'
  when p_phone ~ '^\+389[0-9]{8}$'    then 'mk-one-way-2026-10-25'
  when p_phone ~ '^\+386[0-9]{8}$'    then 'si-one-way-2026-10-25'
  when p_phone ~ '^\+385[0-9]{8,9}$'  then 'hr-one-way-2026-10-25'
  when p_phone ~ '^\+356[0-9]{8}$'    then 'mt-one-way-2026-10-25'
  when p_phone ~ '^\+357[0-9]{8}$'    then 'cy-one-way-2026-10-25'
  when p_phone ~ '^\+44[0-9]{9,10}$'  then 'uk-one-way-2026-10-25'
  when p_phone ~ '^\+39[0-9]{6,12}$'  then 'it-one-way-2026-10-25'
  when p_phone ~ '^\+30[0-9]{10}$'    then 'gr-one-way-2026-10-25'
  when p_phone ~ '^\+43[0-9]{7,13}$'  then 'at-one-way-2026-10-25'
  when p_phone ~ '^\+36[0-9]{8,9}$'   then 'hu-one-way-2026-10-25'
  when p_phone ~ '^\+51[0-9]{9}$'     then 'pe-one-way-2026-10-25'
  when p_phone ~ '^\+32[0-9]{8,9}$'   then 'be-one-way-2026-10-25'
  when p_phone ~ '^\+57[0-9]{10}$'    then 'co-one-way-2026-10-25'
  else null end;
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

-- Eligibility scope widened to the reviewed one-way countries. Consent version,
-- verified paid-until, active membership and suppression checks are unchanged.
create or replace function public.sms_alpha_eligible(p_phone text,p_version text)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 select p_phone ~ '^\+(355|382|389|386|385|356|357|44|39|30|43|63|36|51|32|57)[0-9]' and exists(select 1 from public.sms_alpha_permissions
 where phone=p_phone and consent_version=p_version and consent_at<=now() and paid_verified_until>now())
 and exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 and not exists(select 1 from public.sms_global_suppressions where phone=p_phone)
$$;
revoke all on function public.sms_alpha_eligible(text,text) from public,anon,authenticated;
grant execute on function public.sms_alpha_eligible(text,text) to service_role;
commit;
