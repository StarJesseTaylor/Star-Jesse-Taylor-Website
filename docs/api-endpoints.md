# API Endpoints (`api/`)

43 Vercel serverless functions. All are plain Node.js using raw `fetch` (no SDKs). Filename maps to route: `api/foo.js` → `/api/foo`, `api/admin/bar.js` → `/api/admin/bar`.

Env var names are listed per group; **no secret values appear anywhere**. See `docs/integrations-and-env.md` for the full env table.

---

## 1. Public form handlers (lead capture → ActiveCampaign + Resend)

These share a near-identical shape: CORS `*` + OPTIONS preflight, `website_url` honeypot, a "gibberish name" regex bot filter, a `health_check` marker short-circuit, then AC `contact/sync` → add to a numbered list → find/create tags → optional `notes`, plus Resend confirmation to the user and/or notification to Star. **The `applyTag` helper is byte-for-byte duplicated across ~10 of these files** (no shared module).

| Route | Purpose | AC list (default) | Sends email? | Key env |
|---|---|---|---|---|
| `/api/subscribe` | Generic email signup | `3` | no | `ACTIVECAMPAIGN_API_KEY/URL` |
| `/api/join-letter` | "Star's Letters" newsletter (+ optional SMS opt-in) | `AC_LETTER_LIST_ID` (3) | user + Star | `RESEND_API_KEY`, `AC_LETTER_LIST_ID` |
| `/api/sms-optin` | Standalone SMS opt-in w/ TCPA consent note | `3` | no | `ACTIVECAMPAIGN_API_KEY/URL` |
| `/api/quiz-submit` | Main quiz funnel; path/symptom tags + path-specific welcome email | `4` | user | `RESEND_API_KEY`, `ACTIVECAMPAIGN_*` |
| `/api/qualify` | "Find Your Path" quiz; large tag-map, saves score/tier note | `3` | no | `ACTIVECAMPAIGN_*` |
| `/api/coaching-application` | 1-on-1 / package application; **emails Star = success criterion** | `AC_COACHING_LIST_ID` (7) | user + Star | `RESEND_API_KEY`, `AC_COACHING_LIST_ID` |
| `/api/cohort-waitlist` | 10-week cohort waitlist | `AC_COHORT_LIST_ID` (4) | user + Star | `RESEND_API_KEY`, `AC_COHORT_LIST_ID` |
| `/api/event-waitlist` | Online "Anxiety→Confidence" workshop waitlist | `AC_EVENT_LIST_ID` (5) | user + Star | `RESEND_API_KEY`, `AC_EVENT_LIST_ID` |
| `/api/tour-interest` | Multi-city workshop tour interest | `AC_EVENT_LIST_ID` (5) | user + Star | `RESEND_API_KEY`, `AC_EVENT_LIST_ID` |
| `/api/la-meetup-waitlist` | Monthly LA in-person meetup | `AC_LA_MEETUP_LIST_ID` (6) | user + Star | `RESEND_API_KEY`, `AC_LA_MEETUP_LIST_ID` |
| `/api/whats-next` | Combined workshop/cohort/community interest | `3` | user | `RESEND_API_KEY`, `ACTIVECAMPAIGN_*` |
| `/api/speaking-inquiry` | Speaking-engagement inquiries; emails Star | `3` | Star | `RESEND_API_KEY`, `ACTIVECAMPAIGN_*` |
| `/api/zoom-rsvp` | Virtual/Zoom event RSVP; connection+intent tags | `3` | no | `ACTIVECAMPAIGN_*` |
| `/api/workshop-questionnaire` | Post-purchase LA-workshop buyer questionnaire (past event) | `3` | no | `ACTIVECAMPAIGN_*` |
| `/api/audacity-waitlist` | Audacity app launch waitlist | `AC_AUDACITY_LIST_ID` (3) | user + Star | `RESEND_API_KEY`, `AC_AUDACITY_LIST_ID` |
| `/api/audacity-tester-apply` | Audacity beta-tester app; re-scores tier a/b/c, mirrors to Supabase | `AC_AUDACITY_LIST_ID` (3) | Star | `RESEND_API_KEY`, `SUPABASE_*`, `AC_AUDACITY_LIST_ID` |

**Inconsistencies flagged** (detail in `docs/state-and-todos.md`): when the AC key is missing, some of these return `200` ("captured to email/logs") and others return `500`; `tour-interest.js` is the only CommonJS handler and has **no CORS/OPTIONS** and notifies a different address (`jessetaylortraxxx@gmail.com`); tag-lookup is exact-match in most but "first search hit" in `speaking-inquiry.js` and case-insensitive in `sms-optin.js`; honeypot name-length threshold varies (`{12,}` vs `{15,}`).

---

## 2. Book checkout + webhook (Stripe → Resend + ActiveCampaign)

| Route | Method | Purpose | Notable |
|---|---|---|---|
| `/api/book-checkout` | GET (303 redirect) / POST (JSON `{url,id}`) | Creates a Stripe Checkout session for the $29 book (`BOOK_PRICE_USD`, default 2900¢). `success_url`→`/book-thank-you`, `cancel_url`→`/book`. | No CORS; origin from `req.headers.host`. |
| `/api/book-webhook` | POST, `bodyParser:false` | Stripe `checkout.session.completed` → emails buyer the download link + tags buyer in AC. | **Uses different AC env names** `AC_API_URL`/`AC_API_TOKEN` (every other handler uses `ACTIVECAMPAIGN_API_URL`/`_KEY`) — AC step silently no-ops if those aren't separately set. Signature verify is **skipped if `STRIPE_WEBHOOK_SECRET` unset**, not wrapped in try/catch, and has no replay-tolerance check. `BOOK_PDF_URL` falls back to a page (not a PDF). |

Env: `STRIPE_SECRET_KEY`, `BOOK_PRICE_USD`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `AC_API_URL`, `AC_API_TOKEN`, `BOOK_PDF_URL`.

> Note: a second, **older** book-purchase path still exists in copy — `chat.js` and `quiz-submit.js` hardcode the legacy Beacons shop link (`starjessetaylor.bio/shop/...`). Two divergent book routes coexist.

---

## 3. LLM endpoints (Anthropic)

| Route | Model (as written in code) | Auth | Purpose |
|---|---|---|---|
| `/api/chat` | `claude-haiku-4-5-20251001` | **none** (public) | "Star AI" website chatbot. Large hardcoded system prompt (framework, offers, Hormozi sales, `[CTA:…]`/`[TESTIMONIAL:…]` tag conventions). Last 20 turns, 4000-char clamp, `max_tokens:800`. |
| `/api/yt-agent` | `claude-sonnet-4-6` | optional `YT_AGENT_PASSWORD` (only if that env is set) | Private YouTube-strategy agent for Star. Last 30 turns, `max_tokens:2000`. |

Both are direct cost/abuse surfaces on `ANTHROPIC_API_KEY` (chat has no auth or rate limiting). Three different Anthropic model IDs appear across the codebase (see also Blue = `claude-opus-4-7`, email-writer polish = `claude-sonnet-4-6`); validity not verifiable from code alone.

---

## 4. Event seat counter (Stripe read)

| Route | Purpose | Notable |
|---|---|---|
| `/api/event-seats` | GET; returns live LA-event sold/remaining/GA/VIP for the page counter. | Imports `fetchTotalEventTicketSales` from `blue/_lib.js`. 5-min in-memory cache per warm instance. On Stripe error returns safe `sold:0` (UI hides counter). **Past event (May 30 2026) → effectively stale.** Stripe query is `limit=100`, last 90 days, **no pagination** (undercounts beyond 100 charges). |

---

## 5. Admin APIs (`api/admin/`) — back ends for `admin/*.html`

**All six auth identically: `?key=<CRON_SECRET>`** (compared to `process.env.CRON_SECRET`; 401 if unset/mismatch). CORS `*`. There is **no separate admin password**; `CRON_SECRET` is the de-facto admin key.

| Route | Purpose | Data source |
|---|---|---|
| `/api/admin/dashboard` | Live LA-event sales analytics (velocity, projected fill, recent sales). | Stripe via `_lib`. Returns customer email/name in JSON. |
| `/api/admin/testers-list` | All tester applicants sorted tier A→B→C→waitlist. | Supabase `tester_applications`. |
| `/api/admin/testers-update` | POST `{id,status,star_notes?}`; stamps `invited_at`/`declined_at`. | Supabase PATCH. Allows `duplicate` status (doc comment omits it). |
| `/api/admin/testers-backfill` | Rebuild `tester_applications` rows from AC tags (idempotent by email). | AC → Supabase. "Upsert" is check-then-insert (duplicate risk under concurrency). |
| `/api/admin/star-relationships` | List AC contacts with "established relationship" tags (catch tester applicants who lied). | ActiveCampaign. |
| `/api/admin/audit-bot-signups` | GET lists gibberish-name bot contacts; POST `{ids}` deletes them (max 500, permanent). | ActiveCampaign. |

Env: `CRON_SECRET`, `ACTIVECAMPAIGN_API_KEY/URL`, `SUPABASE_URL`(/`NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`.

---

## 6. Email-writer APIs (`api/email-writer/`) — back end for `admin/email-writer.html`

**All five auth `?key=<CRON_SECRET>`.** Lets Star dictate → polish in his voice → send an AC campaign to a tag-based audience.

| Route | Purpose | Notable |
|---|---|---|
| `/api/email-writer/polish` | POST raw dictation → `{subject, body}` in Star's voice. | Anthropic `claude-sonnet-4-6`, inline `SYSTEM_PROMPT` with Star's hard rules. Header comment claims it reads the prompt from Documents — **it doesn't** (inline constant). |
| `/api/email-writer/tags` | List all AC tags w/ live contact counts, sorted. | Parallel chunks of 10. |
| `/api/email-writer/history` | Last 20 AC campaigns w/ opens/clicks. | — |
| `/api/email-writer/send` | Create + optionally send an AC campaign (`draft`/`send-now`/`schedule`). | **Audience targeting is effectively broken:** the tag segment is created but never linked to the campaign, so it sends to the whole `AC_AUDACITY_LIST_ID` list, not the selected tags. Sends `logic:'"or"'` (double-quoted). `send-now` sets `sdate` 60s in the past. |
| `/api/email-writer/test-send` | POST `{subject,body}` → `[TEST]` email to hardcoded `starjessetaylor@gmail.com`. | Resend only. |

Env: `CRON_SECRET`, `ANTHROPIC_API_KEY`, `ACTIVECAMPAIGN_API_KEY/URL`, `AC_AUDACITY_LIST_ID`, `RESEND_API_KEY`.

---

## 7. Scheduled crons (the 4 in `vercel.json`)

| Route | Schedule (UTC) | Auth | Purpose |
|---|---|---|---|
| `/api/health-check` | `0 13 * * *` | **none** | POSTs a marker payload to 13 hardcoded form endpoints + checks Resend `/domains`; retries 3× over 90s; 🚨 emails Star on failure, Sunday heartbeat on all-pass. Relies on each form honoring the `health_check` marker to skip AC tagging. |
| `/api/feedback-health-check` | `0 14 * * *` | `?token=HEALTH_CHECK_TRIGGER_TOKEN` (only if set; else open) | Pokes Supabase Edge Function `send-feedback` once/day; alerts Star on failure. Only CommonJS (`module.exports`) file. |
| `/api/video-health-check` | `0 15 * * *` | `x-vercel-cron` OR `?key=CRON_SECRET` OR any GET | Crawls 13 live pages, extracts YouTube embed IDs, verifies via oembed; emails Star on broken embeds. |
| `/api/whats-next-digest` | `0 14 * * *` | same as above | Emails Star a digest of AC contacts tagged `interest:skool-community` in the last 24h; silent if none (Resend-quota discipline). |

> The two **Blue** crons (`/api/blue/daily-cron`, `/api/blue/midday-checkin`) were removed from `vercel.json` on Jun 29 2026 to pause sends. Their handler code is intact and still reachable manually. See `docs/blue-agent.md`.

## 8. Blue agent + its Stripe webhook

`api/blue/_lib.js`, `daily-cron.js`, `midday-checkin.js`, `stripe-webhook.js` — documented in full in **`docs/blue-agent.md`**. The Stripe webhook (`/api/blue/stripe-webhook`) is **still active** and handles $500 clarity-session and event-ticket milestone emails.
