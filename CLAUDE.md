# CLAUDE.md — Star Jesse Taylor Website

Map of this project. Keep this file short; the depth lives in `docs/`.

## What this is
The marketing + funnel website for **Star Jesse Taylor** (Emotional Fitness coach, author, workshops, the "Audacity" app). It's a **static multi-page HTML site with no build step and no `package.json`**, deployed on **Vercel**, with dynamic behavior handled by **43 Vercel serverless functions** in `api/` (plain Node, raw `fetch`, no SDKs).

Three layers: static front end (`*.html` + `css/` + `js/`) → serverless back end (`api/`) → local operator tooling (`scripts/`, not deployed).

## Stack
- **Host/deploy:** Vercel, project `star-jesse-taylor-website`, auto-deploy on push to `main` (repo `StarJesseTaylor/Star-Jesse-Taylor-Website`). Routing + cron in `vercel.json`. No CI, no tests.
- **CRM/ESP:** ActiveCampaign (contacts, tags, numbered lists, campaigns) — the system of record.
- **Email:** Resend (all transactional). **Mailchimp only appears in local `scripts/`.**
- **Payments:** Stripe (book Checkout Session + course payment links; webhooks for book & event/clarity).
- **DB:** Supabase — **only** the `tester_applications` table (beta-tester triage) via raw REST.
- **AI:** Anthropic (chat widget, YouTube agent, the "Blue" email agent, email-writer polish).
- **Analytics:** PostHog + Meta/TikTok pixels (client-side, public IDs).

## Where things live
| Path | What |
|---|---|
| `*.html` (root) | Public pages (marketing, funnel, sales, course-delivery, thank-you). |
| `admin/*.html` | Internal tools, gated by `?key=<CRON_SECRET>`. |
| `api/` | 43 serverless functions (forms, webhooks, LLM, admin, email-writer, crons). |
| `api/blue/` | The autonomous "Blue" email agent + shared `_lib.js`. |
| `js/`, `css/` | Vanilla JS + one global stylesheet. |
| `sql/` | Supabase DDL for `tester_applications`. |
| `scripts/` | ~60 local `.mjs` AC/Mailchimp campaign tools (NOT deployed). |
| `marketing/`, `images/` | Copy/testimonials + image assets (content, not code). |
| `vercel.json` | Rewrites (pretty URLs) + 4 cron jobs. |

## Read next (`docs/`)
- **`docs/strategy.md`** — the business context: brand positioning, the offer-ladder funnel, YouTube/community/seminar goals, and the "build once, deploy three" pathways engine. Read this to weigh any task against where the business is headed.
- **`docs/architecture.md`** — overall design, request flow, deployment, folder map, conventions.
- **`docs/api-endpoints.md`** — every `/api/*` function grouped by purpose, with env vars.
- **`docs/blue-agent.md`** — the "Blue" email agent (currently paused) in detail.
- **`docs/integrations-and-env.md`** — Supabase/Stripe/ActiveCampaign/Resend/Anthropic/Vercel wiring, the **full env-var table (names only)**, and the DB schema.
- **`docs/pages.md`** — HTML page inventory + clean routes + which API each form hits.
- **`docs/frontend.md`** — `js/` behaviors, chat widget, tracking, form-submit pattern, CSS tokens.
- **`docs/scripts.md`** — the local ActiveCampaign/Mailchimp tooling + the proven "AC send pattern."
- **`docs/state-and-todos.md`** — **start here for current state**: feature status, confirmed bugs, stale comments, dead code, tech debt, and open questions.

## Gotchas (don't get burned)
- **No secrets in the repo.** `.env*` is git-ignored and only a partial snapshot; the authoritative env set is in the Vercel dashboard. Never print secret values.
- **No shared helpers between functions** — `applyTag`, CORS, honeypot, Resend senders are copy-pasted across ~10 files. A fix usually needs replicating.
- **`CRON_SECRET` is the de-facto admin password** (`?key=` on every admin/email-writer/cron endpoint). There is no `ADMIN_PASSWORD` despite a stale SQL comment.
- **Star AI chat widget is disabled** (`ENABLED = false` in `js/chat-widget.js`). **Blue's sends are paused** (crons removed from `vercel.json` Jun 29; code intact).
- **`api/email-writer/send.js` mis-targets** — the tag segment isn't linked, so it can send to the whole list. Verify before using.
- **Two outdated docs at root:** `SETUP.md` (EmailJS/Netlify) and `claude-handoff.md` (May 4) — history only, not current truth.
- Uncommitted edits currently in the tree (see `docs/state-and-todos.md`).
