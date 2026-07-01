# Blue — Autonomous Email Agent (`api/blue/`)

"Blue" is Star's AI chief-of-staff. It runs as serverless functions that call Claude to write strategic emails and send them (via Resend) to Star, driven by cron schedules and Stripe payment events. There is also a longer human-facing README at `api/blue/README.md` (setup steps + cost estimate ~$0.50/month).

## Files

| File | Role |
|---|---|
| `api/blue/_lib.js` | **Shared library.** Config, Claude caller, Resend sender, Stripe readers, auth + date helpers. Imported by the two crons, the Stripe webhook, and `api/admin/dashboard.js` + `api/event-seats.js`. |
| `api/blue/daily-cron.js` | Daily decision engine: decides whether to send a Sunday letter, a countdown email, or a sales-stall intervention. |
| `api/blue/midday-checkin.js` | Weekday midday email asking Star one reflective question (answers become training data). |
| `api/blue/stripe-webhook.js` | Fires on successful Stripe payments: clarity-session buyer flow + event-ticket milestone emails. |

## `_lib.js` — `BLUE_CONFIG` (hardcoded)

```
recipient: 'starjessetaylor@gmail.com'
fromName:  'Blue'
fromEmail: 'blue@starjessetaylor.com'
eventDate: '2026-05-30T15:00:00-07:00'
eventName: 'Stop the Mental Loop · LA Live Workshop'
totalSeats: 20   gaSeats: 12   vipSeats: 8
countdownDays: [21,14,7,3,1]
milestoneCounts: [1,5,10,15,20]
interventionThresholdDays: 3
model: 'claude-opus-4-7'
```

Helpers:
- `callBlue(...)` → Anthropic `POST /v1/messages` (model `claude-opus-4-7`, `anthropic-version: 2023-06-01`) with the condensed `BLUE_EMAIL_SYSTEM_PROMPT`.
- `sendBlueEmail(...)` → Resend `POST /emails`, plain text → inline-styled HTML.
- `fetchStripeChargesLastDays(days)`, `fetchTotalEventTicketSales()` → Stripe `GET /v1/charges` (last 90 days for tickets); counts `succeeded && !refunded`; **ticket detection by exact cents amount** `9700` ($97 GA) / `34700` ($347 VIP). `limit=100`, **no pagination**.
- `isAuthorizedCron(req)` → true if `Authorization: Bearer ${CRON_SECRET}` **or** `?key=${CRON_SECRET}`; false if `CRON_SECRET` unset.
- `isPTSunday()`, `daysUntilEvent()` — **hardcode UTC-7 (PDT)**; self-noted as wrong during PST and near midnight PT.

Env: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`.

## `daily-cron.js` — send-decision logic

Auth via `isAuthorizedCron`. Decision order:
1. `?force=sunday_letter|countdown|intervention` overrides everything.
2. else `isPTSunday()` → **Sunday strategic letter**.
3. else `daysUntilEvent ∈ [21,14,7,3,1]` → **countdown email**.
4. else if `1 < days < 30` and Stripe shows **zero** ticket sales in the last 3 days → **intervention email**.
5. else → `200 {status:'no email today'}`.

When a type is chosen it gathers Stripe context, builds a per-type prompt, calls Claude (`max_tokens:1500`), and sends via Resend.

## `midday-checkin.js`

Auth via `isAuthorizedCron`. Early-returns on weekends (`getUTCDay()` 0/6). Otherwise builds a one-question prompt from its own hardcoded question bank, `callBlue(...,600)`, `sendBlueEmail`.

## `stripe-webhook.js` — `/api/blue/stripe-webhook` (STILL ACTIVE)

- POST only, `bodyParser:false`. Verifies Stripe signature via Web Crypto HMAC-SHA256 **only if** both `STRIPE_WEBHOOK_SECRET` and the `stripe-signature` header are present (otherwise verification is skipped — self-noted "simpler, less secure").
- On success:
  1. **$500 Clarity Session** (`50000`¢) → notify Star + confirm buyer (direct Resend calls; from `hello@`, reply-to `star@`) + tag `coaching:clarity-session-paid` in AC (non-blocking). Inline comment documents a Jun 18 2026 fix (previously ignored $500 buyers).
  2. **$97/$347 tickets** → re-count all-time tickets; when the count hits a `milestoneCounts` threshold (incl. SOLD OUT at 20), Claude writes a milestone/sellout email → Resend to Star.
- Failures are logged, never returned to Stripe (avoids infinite retries).
- Env: `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `ACTIVECAMPAIGN_API_KEY/URL`.

## ⚠️ Current state: sends are PAUSED (but code is intact)

- On **Jun 29 2026** (commit `b4661e9`) the two Blue cron entries were **deleted from `vercel.json`** (`/api/blue/daily-cron` @ `0 15 * * *` and `/api/blue/midday-checkin` @ `0 19 * * 1-5`). There is **no pause guard in the handler code** — the code would still send if invoked.
- **To re-enable:** restore those two cron entries in `vercel.json` and redeploy.
- The endpoints remain reachable manually with a valid `CRON_SECRET` (bearer or `?key=`).
- Independently, the configured `eventDate` (May 30 2026) is now in the past, so Blue's countdown/intervention branches are dead-lettered until `BLUE_CONFIG.eventDate`/`eventName` are pointed at a new event. The Sunday-letter branch would still fire if the cron were restored.
