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
| Stripe **book** checkout + webhook + Blob download | **Live & verified-configured** (2026-07-01). Checkout → webhook → `book-download` stream all deployed; Stripe live key + webhook secret + Blob token confirmed set via production probes. One real/promo purchase still needed to confirm the PDF actually delivers and the webhook endpoint is registered. |
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
2. **Book funnel — VERIFIED live & configured (2026-07-01).** The live code is newer than the initial audit. `book-webhook.js` uses the correct `ACTIVECAMPAIGN_API_URL/KEY` + `Api-Token` header and tags buyers `book-buyer`, `owns:emotional-fitness-book`, `path:book-purchase`, etc.; delivery is via `api/book-download.js` (Stripe-session-authenticated stream from a private Vercel Blob store), not a `BOOK_PDF_URL` link. Production probes confirmed `STRIPE_SECRET_KEY` (live mode), `STRIPE_WEBHOOK_SECRET`, and `BLOB_READ_WRITE_TOKEN` are all set; checkout builds a real `cs_live_` session; webhook signature verification is active. **Still unverified (needs one real or 100%-off-promo purchase):** that the Stripe webhook endpoint is actually registered in the Stripe dashboard, and that the Blob holds the PDF at `BOOK_BLOB_PATHNAME` (default `'EMOTIONAL FITNESS BOOK PDF'`) — a mismatch yields a 502 "email star@" instead of the book.
3. **Minor (book):** `verifyStripeSignature` isn't wrapped in try/catch (a `timingSafeEqual` length mismatch on malformed input throws → 500 instead of 400); low priority since the secret is set and real Stripe signatures are well-formed. Price defaults to `2999` (=$29.99) in `book-checkout.js`/`book-webhook.js` while a comment says 2900; effective price is $29.99 unless `BOOK_PRICE_USD` is set.
4. **Skool community URL split — FIXED (2026-07-01).** `community.html` and `slideshow-brain-algorithm.html` pointed at `skool.com/the-brain-algorithm`, which returns **HTTP 404 (dead)**. The live community is `skool.com/star-jesse-taylor-3703` (HTTP 200; used by `index.html`, `book-webhook.js`, `book-thank-you.html`). Both stale pages were repointed to the live URL. **Canonical community URL going forward: `https://www.skool.com/star-jesse-taylor-3703`.** Any new page that links to the community must use this.
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
2. Whether the Stripe webhook endpoint is registered in the Stripe dashboard pointing at `/api/book-webhook` for `checkout.session.completed`, and whether the Blob store holds the PDF at the expected pathname. Confirm both with one 100%-off promo-code test purchase (checkout has promo codes enabled, so this is free).
3. Whether the uncommitted `star@` email edits + the `scripts/` toolkit should be committed.
4. The exact Stripe webhook endpoints configured in the Stripe dashboard (code expects `/api/book-webhook` and `/api/blue/stripe-webhook`) and whether their signing secrets are set.
5. Whether the 3 Anthropic model IDs in code (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7`) are all currently valid/intended.
6. When/whether to flip `ENABLED = true` on the chat widget, restore Blue's crons, and point `BLUE_CONFIG` at the next event.
