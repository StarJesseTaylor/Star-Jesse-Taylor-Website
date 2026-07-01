# Current State, Bugs, TODOs & Loose Ends

Everything here is derived from the actual code, config, and git history as of **2026-07-01**. Items marked **(open question)** need Star to confirm — the code alone doesn't say.

## Uncommitted / in-progress work (git working tree)

Modified but **not committed**:
- `api/coaching-application.js` — notification `to` switched from `starjessetaylor@gmail.com` → `star@starjessetaylor.com` (gmail moved to `cc`); applicant `reply_to` → `star@`; error-message fallback address updated.
- `api/join-letter.js` — same `star@` switch for confirmation `reply_to` and Star notification.
- `.gitignore` — added `.env*`.

Untracked at root / in `scripts/`: the entire `scripts/*.mjs` toolkit is untracked, plus `scripts/AC-SEND-PATTERN-README.md`, `scripts/.workshop-targets.json`, `Usersstarjac_tags_full.json`, `Usersstarjac_segments_sets.json`, `remote-control-test.txt`, `marketing/testimonials/katie-hayman-spark.md`.

➡️ **Decision needed (open question):** commit the two `star@` email edits + the scripts, or keep them local? The email edits look intentional and finished; the AC scripts are operator tooling that may be deliberately kept out of the repo.

## Feature state (from code)

| Feature | State |
|---|---|
| Static marketing/funnel pages | **Live.** ~40 pages, all wired to form APIs. |
| Form → ActiveCampaign + Resend pipeline | **Live** across all lead forms. |
| Stripe **book** checkout + webhook | **Newly added** (latest commit `7b3af6a`, files dated today). See webhook risks below. |
| Course sales via Stripe **payment links** | **Live** (links + redirect targets in `STRIPE_REDIRECT_URLS.txt`). |
| Supabase tester-application triage + admin UI | **Live.** Table `tester_applications`, `admin/testers.html`. |
| Health-check / digest crons (4) | **Live** in `vercel.json`. |
| **Star AI chat widget** | **Built but DISABLED** — `ENABLED = false` kill switch in `js/chat-widget.js`. `/api/chat` is live but never called from the UI. |
| **Blue autonomous email agent** | **Paused** — cron entries removed from `vercel.json` (Jun 29). Handler code intact; Stripe webhook still active. Event date is now in the past. |
| July 1 community launch (Skool) | Countdown bar hitting zero **today**; `community.html`/`slideshow` redirect to Skool. |
| Announcement bar | **Live**, flipping to "community is open" state today. |
| Free-chapter offer | **Retired** — `/api/free-chapter` returns 410; `free-chapter.html` redirects to quiz. |

## Confirmed bugs / risks (in code)

1. **`api/email-writer/send.js` audience targeting is broken.** The tag-based segment is created but never linked to the campaign, and the computed per-tag `conditions` are never sent to AC. Result: campaigns send to the **entire `AC_AUDACITY_LIST_ID` list**, not the selected tags. Also sends `logic:'"or"'` (double-quoted string). **This can mis-send email to everyone — verify before using the email-writer "send" button.**
2. **`api/book-webhook.js` uses the wrong AC env-var names** (`AC_API_URL`/`AC_API_TOKEN` vs the standard `ACTIVECAMPAIGN_API_URL`/`_KEY`). If those aren't separately set in Vercel, book buyers are **not tagged in AC** (email still sends). **(open question: are `AC_API_*` provisioned in Vercel?)**
3. **`api/book-webhook.js` signature handling is fragile:** verification is **skipped entirely if `STRIPE_WEBHOOK_SECRET` is unset**; `verifyStripeSignature` isn't in a try/catch (a `timingSafeEqual` length mismatch throws → 500 not 400); no timestamp/replay tolerance.
4. **`BOOK_PDF_URL` fallback is a web page, not a PDF** — if the env var is unset, buyers get a link to `/book`, not the actual download. **(open question: is `BOOK_PDF_URL` set, and to a real file?)**
5. **`api/tour-interest.js` is inconsistent and cross-origin-fragile:** only CommonJS handler, **no CORS headers / no OPTIONS**, and notifies `jessetaylortraxxx@gmail.com` instead of the usual address.
6. **Two open LLM endpoints on `ANTHROPIC_API_KEY`:** `/api/chat` has **no auth and no rate limiting**; `/api/yt-agent` only gates when `YT_AGENT_PASSWORD` is set. Cost/abuse exposure. (Chat is currently unreachable from the UI because the widget is disabled, but the endpoint is public.)
7. **`/api/health-check` has no auth** (publicly triggerable); `video-health-check` and `whats-next-digest` bypass auth on any `GET`.
8. **Stale event logic:** `event-seats.js`, `workshop-questionnaire.js`, `admin/dashboard.js`, and `BLUE_CONFIG` all target the **May 30 2026** LA event (now past). Stripe ticket queries are `limit=100` with **no pagination** (undercount beyond 100 charges).
9. **Timezone shortcuts:** `_lib.isPTSunday()` and `midday-checkin` weekend logic hardcode UTC offsets — wrong during PST and near midnight PT.
10. **`testers-backfill.js` "upsert" is check-then-insert** without a DB unique constraint → duplicate rows possible under concurrency.

## Stale comments / docs (mislead a fresh reader)

- `SETUP.md` describes **EmailJS + Netlify** — neither is used; the site is Vercel + Resend + serverless. **Outdated.**
- `claude-handoff.md` is a **May 4 2026** snapshot — good history, not current.
- `sql/tester_applications_table.sql` comment says endpoints are "protected by `ADMIN_PASSWORD`" — **that env var doesn't exist**; auth is `CRON_SECRET`.
- `api/email-writer/polish.js` header says it loads the system prompt "from the local Documents folder" — it actually uses an **inline** constant.
- `api/quiz-submit.js` docstring promises a "free chapter link" in the welcome email — the offer is **retired**; the email has no such link.
- `api/chat.js` system prompt and `api/quiz-submit.js` `BOOK_PURCHASE_URL` still point at the **old Beacons shop** (`starjessetaylor.bio/shop/...`) instead of the new Stripe `/api/book-checkout` path. Two book-purchase routes coexist.
- `js/posthog-init.js` docstring overstates which events fire as PostHog captures (only `whats_next_signup` actually does).

## Dead / dormant code

- `js/chat-widget.js` — entirely inert (`ENABLED = false`).
- `js/main.js` — `#emailCaptureForm`, `#intensiveWaitlist`, `#intensiveWaitlistServices` handlers have **no matching HTML** (free-chapter retired; intensive forms gone; EmailJS not loaded).
- `api/free-chapter.js` — intentional 410 stub.

## Architecture-level tech debt

- **Massive copy-paste, no shared modules.** `applyTag`, `bodyToHtml`, AC pagination, CORS block, honeypot, and Resend senders are duplicated across ~10+ handlers. `api/blue/_lib.js` is the *only* shared module. A single behavior change means editing many files. A shared `api/_lib/activecampaign.js` + `resend.js` + `cors.js` would remove most of it.
- **Inconsistent failure behavior:** on a missing AC key, some forms return `200` (graceful) and others `500`. Standardize.
- **Inconsistent bot-filter thresholds** (`{12,}` vs `{15,}` gibberish-name regex) with no shared constant.
- **Inconsistent tag lookup:** exact-match in most handlers, "first search hit" in `speaking-inquiry.js`, case-insensitive in `sms-optin.js`.
- **ESM vs CommonJS mismatch:** `tour-interest.js` and `feedback-health-check.js` use `module.exports`; everything else uses `export default`.

## Things a fresh session can't determine from code alone (open questions)

1. Which env vars are **actually set in the Vercel dashboard** — the local `.env.production` is a partial snapshot (missing e.g. `SUPABASE_*`, `AC_*_LIST_ID`, `BOOK_*`, `STRIPE_WEBHOOK_SECRET`). Confirm the full set in Vercel.
2. Whether `AC_API_URL`/`AC_API_TOKEN` (book-webhook) and `BOOK_PDF_URL` are provisioned (bugs #2, #4 depend on this).
3. Whether the uncommitted `star@` email edits + the `scripts/` toolkit should be committed.
4. The exact Stripe webhook endpoints configured in the Stripe dashboard (code expects `/api/book-webhook` and `/api/blue/stripe-webhook`) and whether their signing secrets are set.
5. Whether the 3 Anthropic model IDs in code (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7`) are all currently valid/intended.
6. When/whether to flip `ENABLED = true` on the chat widget, restore Blue's crons, and point `BLUE_CONFIG` at the next event.
