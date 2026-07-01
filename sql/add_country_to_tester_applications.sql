-- Add country to tester_applications (Star June 15 2026)
--
-- Star asked to capture country in the tester quiz so we can:
--  - Plan live calls across time zones
--  - Know where future workshop cities should be
--  - Tag in AC for regional follow-up
--
-- Idempotent migration. Safe to run multiple times.

alter table public.tester_applications
  add column if not exists country text;

create index if not exists idx_tester_applications_country
  on public.tester_applications (country)
  where country is not null;
