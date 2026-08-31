-- ============================================================================
-- AUDACITY GAMES — the 30-day valued-action board (starjessetaylor.com/games)
--
-- One row per member. The member list itself lives in games.html; this table
-- only holds progress + the claim token, so there is nothing to seed.
--
-- claim-your-row security: the first device to tap a name sets owner_token.
-- After that, only requests carrying that token can edit that row. The API
-- (api/games.js, service_role key, server-side) enforces it. owner_token is
-- NEVER returned to the client — only a boolean "claimed".
--
-- Reset for Sept 1: `truncate public.games_progress;` (or the API reset op)
-- wipes all test data so the real challenge starts clean.
--
-- Additive only. Touches no existing table. Safe to run.
-- Project: ralmodzgkcaqkvliryne (same Supabase as the app).
-- ============================================================================

create table if not exists public.games_progress (
  member_name  text primary key,
  owner_token  text,                                   -- null = unclaimed. set on first claim.
  days         jsonb not null default '{}'::jsonb,     -- {"1":["fit","content"],"2":["art"], ...}
  updated_at   timestamptz not null default now()
);

-- All access goes through the serverless function with the service_role key,
-- which bypasses RLS by design. Enable RLS with no anon policies so the table
-- is not directly readable/writable with the public anon key.
alter table public.games_progress enable row level security;

comment on table public.games_progress is
  'Audacity Games 30-day board. One row per member. owner_token = claim (never sent to client). days = {day: [garden keys]}.';
