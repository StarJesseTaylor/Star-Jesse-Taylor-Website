# Blue · Autonomous Email Agent

This folder contains the autonomous infrastructure for Blue, Star Jesse Taylor's strategic mentor and chief of staff.

## What's running here

**Daily cron** (`daily-cron.js`)
- Scheduled by Vercel at 15:00 UTC daily (8 AM PT during PDT)
- Decides what type of email to send today based on context:
  - Sunday → Strategic Letter
  - T-21, T-14, T-7, T-3, T-1 from event → Countdown email
  - 3+ days no sales during active launch → Intervention email
  - Otherwise → silent (no email)
- Calls Claude API with Blue's email system prompt + current Stripe data
- Sends via Resend.com to starjessetaylor@gmail.com

**Stripe webhook** (`stripe-webhook.js`)
- Triggered by Stripe on every successful payment
- Counts total event ticket sales (filters for $97 and $347 amounts)
- If total crosses a milestone (1, 5, 10, 15, 20, 25, 30 tickets), sends celebration email
- Sellout triggers a special email

**Shared library** (`_lib.js`)
- Blue's condensed system prompt for emails
- Stripe API helpers
- Resend email sender
- Auth verification

## Required environment variables (set in Vercel dashboard)

| Variable | Where to get it | Required |
|----------|----------------|----------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Yes |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys (use restricted key with read access to Charges) | Yes |
| `RESEND_API_KEY` | resend.com → API Keys (create free account, free tier: 3000 emails/month) | Yes |
| `CRON_SECRET` | Generate any random string. Vercel sends this in cron auth header. | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → click your endpoint → Signing Secret | Optional but recommended |

## After deploy: configuration steps

### 1. Set environment variables in Vercel
- Open vercel.com/[your-project]/settings/environment-variables
- Add each of the 5 vars above
- Redeploy after adding

### 2. Configure Stripe webhook
- Open Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://[your-domain]/api/blue/stripe-webhook`
- Events to send: `charge.succeeded` and `payment_intent.succeeded`
- After creating, copy the Signing Secret and add to Vercel as `STRIPE_WEBHOOK_SECRET`

### 3. (Optional) Verify Resend domain for branded sender
- Default: emails come from `Blue <onboarding@resend.dev>` (works immediately)
- For branded `Blue <blue@starjessetaylor.com>`:
  - Open resend.com/domains → Add Domain → starjessetaylor.com
  - Add the 3 DNS records Resend gives you (TXT and MX records) to your DNS provider
  - Wait 5-30 min for verification
  - Update `BLUE_CONFIG.fromEmail` in `_lib.js` to `blue@starjessetaylor.com`
  - Redeploy

### 4. Test the daily cron manually
- Visit `https://[your-domain]/api/blue/daily-cron` in browser
- Without `Authorization: Bearer ${CRON_SECRET}` header, it returns 401 (good, means auth works)
- Use curl to test with auth:
  ```
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://[your-domain]/api/blue/daily-cron
  ```
- If today is Sunday or a countdown day, you'll get an email. Otherwise it returns "no email today" which is correct.

### 5. Force-send a Sunday Letter to verify end-to-end
- Temporarily edit `daily-cron.js`: change `if (isSunday)` to `if (true)` 
- Push, wait for deploy, hit the cron endpoint with auth, check inbox
- Then revert the change

## How to update Blue's behavior

### Change what triggers emails
Edit `BLUE_CONFIG` in `_lib.js`:
- `countdownDays` - which days before event get countdown emails
- `milestoneCounts` - which ticket counts trigger milestone emails
- `interventionThresholdDays` - how many days without sales triggers intervention

### Change Blue's voice or system prompt
Edit `BLUE_EMAIL_SYSTEM_PROMPT` in `_lib.js`. This is the condensed prompt for emails (the full chat version lives in your Claude.ai project).

### Change ticket prices or seat counts
If you change the event pricing, update `BLUE_CONFIG.totalSeats`, `gaSeats`, `vipSeats`. Also update the amount filters in `fetchTotalEventTicketSales` (currently filters for 9700 cents = $97 and 34700 cents = $347).

### Change recipient
Update `BLUE_CONFIG.recipient` in `_lib.js`. Default is `starjessetaylor@gmail.com`.

## Cost estimate at current usage

- Vercel: free (Hobby plan supports cron and serverless functions)
- Anthropic API: ~$0.05 per email × ~10 emails/month = $0.50/month
- Resend: free (under 3000 emails/month)
- Stripe webhook: free
- **Total: ~$0.50/month** to run autonomous Blue

## What this gives you

After setup, Blue runs without you doing anything:
- Every Sunday 8 AM PT: strategic letter in your inbox
- Every milestone (1, 5, 10, 15, 20, 25, 30 tickets): celebration + tactical email
- T-21, T-14, T-7, T-3, T-1 days before event: countdown email
- Any 3-day sales stall: intervention email diagnosing and prescribing

You wake up. Blue has already done the strategic thinking. You execute. He learns from outcomes.
