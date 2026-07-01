# Architecture

## What this project is

The marketing / funnel website for **Star Jesse Taylor** (Emotional Fitness coach, author, workshop host, and the "Audacity" app). It is a **static multi-page HTML site** with **no build step, no framework, and no `package.json`**, deployed on **Vercel**. Dynamic behavior comes from **Vercel serverless functions** in `api/` (plain Node.js, ESM, raw `fetch` against third-party REST APIs — no SDKs installed).

Think of it as three layers:

1. **Static front end** — ~40 hand-written `.html` pages at the repo root (plus `admin/` and `preview/`), styled by one global `css/styles.css`, with a handful of shared vanilla-JS files in `js/`.
2. **Serverless back end** — 43 functions under `api/` that handle form submissions, Stripe checkout/webhooks, an AI chat endpoint, an autonomous email agent ("Blue"), admin tools, an email-composer tool, and scheduled health-check / digest crons.
3. **Operator tooling** — ~60 standalone `.mjs` scripts in `scripts/` that Star (or Claude) runs locally to build/send/verify ActiveCampaign and Mailchimp email campaigns. These are **not** part of the deployed site.

## Request flow

```
Browser
  │
  ├── loads static .html + css/styles.css + js/*.js  (served by Vercel CDN)
  │
  ├── form submit ── fetch POST /api/<name> ──► Vercel serverless function
  │                                              │
  │                                              ├── ActiveCampaign REST  (contacts, tags, lists, campaigns)
  │                                              ├── Resend REST          (transactional email to user + Star)
  │                                              ├── Supabase REST        (tester_applications table only)
  │                                              ├── Stripe REST          (checkout sessions, charge reads)
  │                                              └── Anthropic Messages   (chat.js, yt-agent.js, Blue, email polish)
  │
  ├── Star AI chat widget ── POST /api/chat ──► Anthropic  (currently disabled by a front-end kill switch)
  │
  └── Stripe hosted checkout ── webhook ──► /api/book-webhook, /api/blue/stripe-webhook

Vercel Cron (see vercel.json)
  ├── 0 13 * * *  /api/health-check          (form-endpoint monitor)
  ├── 0 14 * * *  /api/feedback-health-check  (Supabase edge-function monitor)
  ├── 0 15 * * *  /api/video-health-check     (YouTube embed monitor)
  └── 0 14 * * *  /api/whats-next-digest       (daily community-signup digest)
```

## Deployment

- **Host:** Vercel. Project name `star-jesse-taylor-website` (linked via the untracked `.vercel/` folder).
- **Repo:** GitHub `StarJesseTaylor/Star-Jesse-Taylor-Website`, branch `main`.
- **Deploy trigger:** push to `origin/main` → Vercel auto-deploys. There is no CI, no test suite, no build command.
- **Routing / pretty URLs:** `vercel.json` `rewrites` map clean paths (`/tour`, `/app`, `/email-writer`, `/slideshow`, `/community`, `/whats-next`, `/relationships`, `/testers`, `/preview/garden`, etc.) to their `.html` files. Anything not rewritten is served by filename.
- **Cron:** `vercel.json` `crons` defines the 4 scheduled jobs above (times are UTC). The two "Blue" crons were **removed** from this file on Jun 29 2026 to pause automated sends (see `docs/blue-agent.md`).
- **Production `star@` mail / domain:** `starjessetaylor.com` (Resend is the sender; some flows are mid-migration from `starjessetaylor@gmail.com` to `star@starjessetaylor.com`).

## Top-level folder map

| Path | What it is |
|---|---|
| `*.html` (root) | All public marketing, funnel, sales, course-delivery, and thank-you pages. See `docs/pages.md`. |
| `admin/*.html` | Password-gated (via `?key=`) internal tools: tester triage, dashboard, email-writer, relationships, bot audit. |
| `preview/garden.html` | Design preview of the Audacity app "garden" screen. |
| `api/` | 43 Vercel serverless functions. See `docs/api-endpoints.md`. |
| `api/blue/` | The autonomous "Blue" email agent + shared `_lib.js`. See `docs/blue-agent.md`. |
| `api/admin/`, `api/email-writer/` | Back ends for the `admin/` HTML tools. |
| `css/styles.css` | Single 1,688-line global stylesheet with `:root` design tokens. |
| `js/` | Vanilla JS: `main.js`, `chat-widget.js`, `announcement-bar.js`, `tracking.js`, `posthog-init.js`. See `docs/frontend.md`. |
| `sql/` | Supabase DDL for the `tester_applications` table (+ a country column migration). See `docs/integrations-and-env.md`. |
| `scripts/` | ~60 local operator `.mjs` scripts for ActiveCampaign/Mailchimp campaigns. See `docs/scripts.md`. |
| `marketing/` | Copy, offers, and verified testimonials (content, not code). `marketing/testimonials/*.md` is the source of truth for quotes. |
| `images/` | 155 image files (photos, slides, email assets) + `PHOTO_INVENTORY.md`. |
| `vercel.json` | Rewrites + cron schedule. |
| `.env.local`, `.env.production` | Vercel-pulled env files (git-ignored). Partial; the authoritative env set lives in the Vercel dashboard. |
| `SETUP.md` | **Outdated** original setup guide (describes EmailJS + Netlify; neither is used now). Historical only. |
| `claude-handoff.md` | **Outdated** May 4 2026 session handoff. Useful context, not current state. |

## Key conventions to know

- **No shared code between functions.** Each serverless handler is self-contained and copy-pastes its helpers (`applyTag`, `bodyToHtml`, AC pagination, CORS block, honeypot). The only shared module is `api/blue/_lib.js`. This means a fix to one form handler must often be replicated across ~10 files.
- **ActiveCampaign is the CRM/ESP of record.** Almost every form syncs a contact + applies tags to a numbered AC list. Supabase is used **only** for tester-application triage state.
- **Resend sends all transactional email** (user confirmations + notifications to Star). Mailchimp appears only in the local `scripts/`, not in the deployed API.
- **Auth is `CRON_SECRET`-based** for every admin/email-writer/cron endpoint (query param `?key=` or `Authorization: Bearer`). There is no separate admin password. See `docs/integrations-and-env.md`.
- **Graceful-degrade philosophy** on public forms: most return HTTP 200 and rely on the email-to-Star as the safety net, so the front end shows success even if a downstream service is down. (Behavior is inconsistent across handlers — see `docs/state-and-todos.md`.)
