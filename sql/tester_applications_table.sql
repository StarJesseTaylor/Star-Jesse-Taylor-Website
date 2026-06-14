-- Star June 14 2026: tester applications need their own admin dashboard.
-- Right now applicants land in ActiveCampaign and Star's email inbox.
-- Both work for triage but neither has 'invited / declined / pending'
-- status that persists, so re-reviewing the same person twice is easy.
--
-- This table is the source of truth for triage state. The API handler
-- inserts here in parallel with the AC sync. Admin page reads from here.

create table if not exists public.tester_applications (
  id uuid primary key default gen_random_uuid(),

  -- Identity
  first_name text not null,
  last_name text,
  apple_email text not null,

  -- Quiz answers
  device text,
  symptoms text,
  goals text,
  duration text,
  severity text,
  tried text,
  worked text,
  not_worked text,
  specific_moment text,
  history text,
  commitment text,
  notes text,
  source text,

  -- Server-side scoring at submission time
  score int,
  tier text check (tier in ('a', 'b', 'c', 'waitlist')),
  ac_contact_id text,

  -- Triage state (the whole reason this table exists)
  status text not null default 'pending'
    check (status in ('pending', 'invited', 'declined', 'maybe', 'duplicate')),
  invited_at timestamptz,
  declined_at timestamptz,
  star_notes text,  -- Star's private notes after reviewing

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tester_applications_tier_status
  on public.tester_applications (tier, status, created_at desc);

create index if not exists idx_tester_applications_status_created
  on public.tester_applications (status, created_at desc);

create or replace function public.set_tester_applications_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tester_applications_updated_at on public.tester_applications;
create trigger tester_applications_updated_at
  before update on public.tester_applications
  for each row execute function public.set_tester_applications_updated_at();

-- No RLS needed: admin endpoints use the service role key. The table
-- is never queried from client code, only from Vercel API routes
-- protected by ADMIN_PASSWORD.
