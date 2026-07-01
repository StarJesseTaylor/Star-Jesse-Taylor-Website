# Integrations, Environment Variables & Database

No provider SDKs are installed. Every integration is called with raw `fetch` against its REST API. **No secret values are stored in this repo's tracked files** (`.env.local` / `.env.production` are git-ignored and only partially populated; the authoritative env set lives in the Vercel dashboard).

## Integrations at a glance

| Service | Used for | How it's called |
|---|---|---|
| **ActiveCampaign** | CRM + ESP of record: contacts, tags, lists, campaigns. Almost every form syncs here. | REST v3 (`/api/3/...`), raw fetch. Base URL from env; account fallback `https://starjessetaylor92181.api-us1.com` is hardcoded in handlers. |
| **Resend** | All transactional email (user confirmations + notifications to Star + Blue's emails). | REST `POST https://api.resend.com/emails`. |
| **Supabase** | **Only** the `tester_applications` table (beta-tester triage state) + one Edge Function `send-feedback`. | REST `GET/POST/PATCH /rest/v1/tester_applications` with the service-role key; Edge Function via anon key. **No `@supabase/*` SDK.** |
| **Stripe** | Book checkout, event-ticket & clarity-session payments, charge reads for counters/dashboards. | REST `api.stripe.com/v1/...`, form-urlencoded. Payment **Links** (hosted) for courses/workshop; a **Checkout Session** for the book. Webhooks: `/api/book-webhook`, `/api/blue/stripe-webhook`. |
| **Anthropic (Claude)** | `chat.js` (Star AI), `yt-agent.js`, Blue emails, email-writer polish. | REST `POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`. Models used: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7`. |
| **Vercel** | Hosting, serverless functions, cron, routing. | `vercel.json` + push-to-deploy. |
| **PostHog** | Product analytics shared with the Audacity app. | `js/posthog-init.js` (public project key, client-side). |
| **Meta / TikTok pixels** | Ad conversion tracking. | `js/tracking.js` (public pixel IDs, client-side). Google/LinkedIn/Pinterest/Twitter are placeholder-only. |

Mailchimp appears **only** in local `scripts/` (campaign tooling), never in deployed `api/` code.

## Environment variables (names only — set in Vercel dashboard)

### Core secrets
| Name | Used by | Notes |
|---|---|---|
| `ACTIVECAMPAIGN_API_KEY` | all AC form/admin/email-writer handlers | AC v3 API key |
| `ACTIVECAMPAIGN_API_URL` | same | AC account base URL |
| `AC_API_TOKEN` | **only** `book-webhook.js` | ⚠️ inconsistent name — see below |
| `AC_API_URL` | **only** `book-webhook.js` | ⚠️ inconsistent name |
| `ANTHROPIC_API_KEY` | `chat`, `yt-agent`, Blue, email-writer polish | |
| `RESEND_API_KEY` | every email-sending handler | |
| `STRIPE_SECRET_KEY` | `book-checkout`, Blue `_lib`, dashboards | |
| `STRIPE_WEBHOOK_SECRET` | `book-webhook`, `blue/stripe-webhook` | optional; **verification is skipped if unset** |
| `CRON_SECRET` | Blue crons + **all** admin + **all** email-writer endpoints | de-facto admin password (`?key=` / `Bearer`) |
| `HEALTH_CHECK_TRIGGER_TOKEN` | `feedback-health-check` | optional gate |
| `YT_AGENT_PASSWORD` | **only** `yt-agent.js` | optional gate; **not** used by admin endpoints |

### Supabase
| Name | Used by |
|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` (fallback) | tester-apply + admin testers + backfill + feedback-health-check |
| `SUPABASE_SERVICE_ROLE_KEY` | tester writes/reads (server-side only) |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `feedback-health-check` Edge Function call |

### ActiveCampaign list IDs (numbered lists; each has a code fallback)
| Name | Default | Purpose |
|---|---|---|
| `AC_AUDACITY_LIST_ID` | `3` | Audacity waitlist/tester + email-writer default |
| `AC_COACHING_LIST_ID` | `7` | coaching applications |
| `AC_COHORT_LIST_ID` | `4` | cohort waitlist |
| `AC_EVENT_LIST_ID` | `5` | event + tour |
| `AC_LA_MEETUP_LIST_ID` | `6` | LA meetup |
| `AC_LETTER_LIST_ID` | `3` | Star's Letters |

### Book
| Name | Used by | Notes |
|---|---|---|
| `BOOK_PRICE_USD` | `book-checkout` | optional, default `2900` (¢) |
| `BOOK_PDF_URL` | `book-webhook` | download link; **falls back to a page, not a PDF, if unset** |

### Client-side (public, committed in source — not secrets)
- Meta Pixel ID and TikTok Pixel ID in `js/tracking.js`.
- PostHog project key + host in `js/posthog-init.js` (same key referenced by the Audacity app's `EXPO_PUBLIC_POSTHOG_API_KEY`).

> ⚠️ **`book-webhook.js` env mismatch:** it reads `AC_API_URL`/`AC_API_TOKEN` while every other handler reads `ACTIVECAMPAIGN_API_URL`/`ACTIVECAMPAIGN_API_KEY`. Unless the `AC_API_*` pair is separately provisioned in Vercel, the webhook's AC tagging step silently no-ops (book buyers won't get tagged in AC even though the email still sends).

## Database (Supabase Postgres)

DDL lives in `sql/`. Only **one** table is used by the app.

### `public.tester_applications` (`sql/tester_applications_table.sql`)
Source of truth for **Audacity beta-tester triage state** (AC + Star's inbox can't persist "invited/declined/pending"). The `/api/audacity-tester-apply` handler inserts here in parallel with the AC sync; `admin/testers.html` reads/updates it.

Columns (abridged):
- **Identity:** `id uuid pk`, `first_name` (req), `last_name`, `apple_email` (req), `country` (added `sql/add_country_to_tester_applications.sql`).
- **Quiz answers:** `device, symptoms, goals, duration, severity, tried, worked, not_worked, specific_moment, history, commitment, notes, source`.
- **Server-side scoring:** `score int`, `tier text CHECK in ('a','b','c','waitlist')`, `ac_contact_id text` (**always null in practice** — the re-mirror step is intentionally skipped in code).
- **Triage state:** `status` default `'pending'` `CHECK in ('pending','invited','declined','maybe','duplicate')`, `invited_at`, `declined_at`, `star_notes`.
- **Timestamps:** `created_at`, `updated_at` (auto via `set_tester_applications_updated_at` trigger).
- Indexes on `(tier,status,created_at)`, `(status,created_at)`, `(country)`.
- **No RLS** — access is server-side only through Vercel functions using the service-role key.

> The DDL comment says the table is "protected by `ADMIN_PASSWORD`," but **`ADMIN_PASSWORD` does not exist anywhere in the code**. The admin endpoints actually gate on `CRON_SECRET` (`?key=`). Treat the comment as stale.

There is also a Supabase **Edge Function `send-feedback`** referenced by `feedback-health-check.js` — its source lives in the Supabase project, **not in this repo**.
