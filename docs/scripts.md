# Operator Scripts (`scripts/`)

~60 standalone Node ESM (`.mjs`) scripts + a README + one JSON. These are **local operator tools** Star (or Claude) runs by hand from the command line to build, send, verify, and troubleshoot **ActiveCampaign** and **Mailchimp** email campaigns. **They are not part of the deployed website** and are not imported by any `api/` function.

## Credentials & config (⚠️ different model from the API)
Scripts do **not** use `process.env`. They read secrets from JSON files **outside this repo**:
- `C:/Users/starj/.claude/secrets/activecampaign.json` → `{ apiUrl, apiKey }`
- `C:/Users/starj/.claude/secrets/mailchimp.json` → `{ api_key, server }`

They also read email HTML templates from `C:/Users/starj/Documents/Star_Pricing_Research/`. (Those paths are referenced by the scripts; the files themselves are outside this project and were not read.)

Hardcoded AC/Mailchimp resource IDs recur across scripts: AC master list `3`; workshop tags `23, 52, 50, 35`; community/skool tag `141`; Mailchimp engaged segment `6398467`; Mailchimp burn campaign `434148f526`; AC message IDs `27` (workshop) / `33` (bicycle).

## The proven "AC send pattern" (`AC-SEND-PATTERN-README.md`)
ActiveCampaign's v3 segment API is unreliable, so the tested recipe is:
1. **Compute contact IDs in JavaScript** (paginate `fetch`, union/filter by tag ID) — don't rely on AC segments.
2. **Create a dedicated AC list** for the send (e.g. "Send-Community-Jun27").
3. **Bulk-add** the computed contacts to that list (~1 POST each; ~3 min for 200).
4. **Fire the campaign** with a **past US-Central `sdate`** (AC server is Central; a past timestamp fires immediately). For scheduling, convert PT→Central (+2h). **Never** use `new Date().toISOString()` (AC misreads UTC as Central).
5. **Verify** (poll `GET /campaigns/{id}`; expect status ≥5, `send_amt>0`, `ldate` set).

Documented failures that *don't* work: v3 segment PUT, v1 include/exclude tags on `campaign_create`, v3 `/campaigns/{id}/test` (405), v1 `campaign_send action=test` (blocked on new accounts).

## Categories
- **Live senders (⚠️ fire real email):** `ac-send-bicycle.mjs` (→ master list ~175–390), `ac-send-workshop-v16.mjs` (→ 173 targets from `.workshop-targets.json`). Both call the guard first.
- **Guards / verification (safe):** `ac-send-guard.mjs` (reusable: `abortIfAlreadySent()` + `verifySent()`), `ac-verify-no-double.mjs`, `ac-workshop-audience-check.mjs`, `verify-*.mjs`.
- **Build + schedule (setup):** `ac-build-and-schedule.mjs` (creates 2 messages + 2 segments + 2 scheduled campaigns), `schedule-and-verify.mjs`, `create-ac-campaign-v1-test.mjs` / `-v3-test.mjs`.
- **Email content builders (safe, local HTML transforms):** `build-workshop-email-v15/16/17-*.mjs`, `build-v16-from-v17.mjs`.
- **Read-only fetch/audit (safe):** `fetch-ac-tags-and-lists.mjs`, `audit-ac-tags-segments.mjs`, `ac-segment-counts.mjs`, `ac-tag-overlap.mjs`, `fetch-segment-*.mjs`, `ac-list-recent-campaigns.mjs`, `ac-star-email-ledger.mjs`, `check-recent-signups.mjs`.
- **Deliverability (safe):** `preflight-spamcheck.mjs` (POSTs HTML to Postmark's free SpamAssassin API; 8.0+ = ship), `deliverability-deep-dive.mjs`.
- **Mailchimp draft workflow (safe — draft only, manual approval):** `create-burn-campaign.mjs`, `create-bicycle-email-drafts.mjs`, `fetch-workshop-email-current.mjs`.
- **⚠️ Versioned campaign updates (mutate a live Mailchimp campaign — risky to re-run):** `update-burn-campaign-v3.mjs` … `v13.mjs`, `update-burn-campaign-images.mjs`.
- **One-off fixes:** `fix-ac-merge-tags.mjs`, `fix-from-address.mjs`, `direct-fix-v17-latest.mjs`, `final-fix-v17.mjs`, `unschedule-and-test.mjs`.
- **Exploration / throwaway:** `ac-v1-correct-auth.mjs`, `ac-deeper-attempt.mjs`, `ac-campaign-create-v2.mjs`, `plan-b-ac-via-mailchimp.mjs`, various `*-test.mjs`.

## Support files
- `.workshop-targets.json` — a flat array of ~173 AC contact-ID strings; consumed by `ac-send-workshop-v16.mjs` (validates length 100–200 before firing).
- `AC-SEND-PATTERN-README.md` — the canonical send recipe above.

## Cautions
- The **live senders** and the **`update-burn-campaign-v*`** chain hit real ActiveCampaign / Mailchimp and can send or alter live campaigns. Re-run only after checking state; the guard functions exist specifically to prevent accidental double-sends.
- The many `v3…v13` / `v14…v17` variants are an iteration trail on the same one or two emails, not distinct tools — most are effectively superseded/throwaway.
