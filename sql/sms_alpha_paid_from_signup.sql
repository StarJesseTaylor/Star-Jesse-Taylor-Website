-- 28 Oct 2026. Apply after sql/sms_alpha_member_countries.sql.
--
-- WHY THIS EXISTS
-- ---------------
-- record_alpha_sms_consent wrote every new signup with
--   paid_verified_until = '1970-01-01'  ("Awaiting membership verification")
-- and nothing ever filled that blank in. sms_alpha_eligible requires
-- paid_verified_until > now(), so EVERY member in a one-way alpha country was
-- born blocked and stayed blocked until somebody ran an UPDATE by hand.
--
-- Four people were cleared by hand on 26 Oct. Seven more signed up behind them
-- and landed in the same hole: Romana, William and Ioana in the UK, Luigi in
-- Italy, Danai in Greece, Kevin in Belgium, Franka in Croatia. The queue was
-- the design, and it refilled faster than it was being emptied.
--
-- Star's ruling, 28 Oct 2026, in his own words:
--   "Well only the people who sign up are paying members so why do you keep
--    asking me to do this? Why can't this happen automatically?"
-- The /sms form is reachable only from the Skool classroom behind the day 8
-- gate, which is paid-members-only. Reaching the form IS the membership
-- evidence. So the signup now records it instead of leaving a blank.
--
-- WHY IT STILL EXPIRES
-- --------------------
-- Nothing in this database learns that a member stopped paying. The column
-- member_channel.status only ever moves to 'stopped' when the member texts
-- STOP, so 'active' is NOT proof that somebody is still a customer. A permanent
-- grant would keep texting people who cancelled months ago, and one-way
-- alphanumeric routes are permitted to EXISTING customers only. A 35 day window
-- covers a monthly billing cycle with slack, and a member who leaves falls out
-- by themselves inside five weeks without anyone remembering to do it.
--
-- A lapse is not silent: an expired window refuses the send, and the refusal is
-- not marked 'expected', so the guard emails Star rather than quietly dropping
-- the person. Renewing from the ActiveCampaign paying-member tag is the next
-- step and removes the lapse entirely.
begin;

create or replace function public.record_alpha_sms_consent(p_phone text,p_version text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $fn$
declare expected text; grant_until timestamptz; grant_evidence text;
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
  when p_phone ~ '^\+972[0-9]{8,9}$'  then 'il-one-way-2026-10-25'
  else null end;
 if expected is null or p_version is distinct from expected then return false; end if;
 if not exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 or exists(select 1 from public.sms_global_suppressions where phone=p_phone) then return false; end if;

 grant_until := now() + interval '35 days';
 grant_evidence := 'Paid membership evidenced by access route, recorded ' || to_char(now(),'YYYY-MM-DD') ||
   '. Owner ruling by Star Jesse Taylor 2026-10-28: the /sms signup form is reachable only from the Skool ' ||
   'classroom behind the day 8 gate, which is open to paying members only, so completing the form is itself ' ||
   'evidence of a current paid membership. Window expires after 35 days and must be renewed from a live ' ||
   'membership signal.';

 insert into public.sms_alpha_permissions(phone,consent_version,consent_at,consent_evidence,paid_verified_until,paid_evidence)
 values(p_phone,p_version,now(),'Website /sms separate unchecked consent checkbox with one-way disclosure version ' || p_version,grant_until,grant_evidence)
 on conflict(phone) do update set consent_version=excluded.consent_version,consent_at=excluded.consent_at,
   consent_evidence=excluded.consent_evidence,
   -- Never shorten a window that is already longer, so a hand-made owner
   -- attestation is not quietly cut back by a later re-consent.
   paid_verified_until=greatest(public.sms_alpha_permissions.paid_verified_until,excluded.paid_verified_until),
   paid_evidence=case when public.sms_alpha_permissions.paid_verified_until>=excluded.paid_verified_until
                      then public.sms_alpha_permissions.paid_evidence else excluded.paid_evidence end;
 return true;
end $fn$;
revoke all on function public.record_alpha_sms_consent(text,text) from public,anon,authenticated;
grant execute on function public.record_alpha_sms_consent(text,text) to service_role;

-- Israel added to the eligible scope. Build scope only: sending still needs
-- SMS_ALPHA_IL_ENABLED and SMS_GEO_IL_READY, so this enables nothing by itself.
create or replace function public.sms_alpha_eligible(p_phone text,p_version text)
returns boolean language sql security definer set search_path=public,pg_temp as $fn$
 select p_phone ~ '^\+(355|382|389|386|385|356|357|44|39|30|43|63|36|51|32|57|972)[0-9]' and exists(select 1 from public.sms_alpha_permissions
 where phone=p_phone and consent_version=p_version and consent_at<=now() and paid_verified_until>now())
 and exists(select 1 from public.member_channel where phone=p_phone and status='active' and consent_at is not null)
 and not exists(select 1 from public.sms_global_suppressions where phone=p_phone)
$fn$;
revoke all on function public.sms_alpha_eligible(text,text) from public,anon,authenticated;
grant execute on function public.sms_alpha_eligible(text,text) to service_role;

-- ONE-TIME BACKFILL for the people already stuck behind the 1970 placeholder.
-- Touches only rows that consented through the website form and were never
-- verified. A hand-written owner attestation is left exactly as it is.
update public.sms_alpha_permissions p
set paid_verified_until = now() + interval '35 days',
    paid_evidence = 'Paid membership evidenced by access route, backfilled 2026-10-28. Owner ruling by Star Jesse '
      || 'Taylor 2026-10-28: the /sms signup form is reachable only from the Skool classroom behind the day 8 gate, '
      || 'which is open to paying members only, so completing the form is itself evidence of a current paid '
      || 'membership. Window expires after 35 days and must be renewed from a live membership signal.'
where p.paid_verified_until <= now()
  and p.paid_evidence = 'Awaiting membership verification'
  and exists(select 1 from public.member_channel m
             where m.phone=p.phone and m.status='active' and m.consent_at is not null)
  and not exists(select 1 from public.sms_global_suppressions s where s.phone=p.phone);

commit;
