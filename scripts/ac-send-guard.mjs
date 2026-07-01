#!/usr/bin/env node
/**
 * Reusable send guards for ActiveCampaign sends.
 * Import these into any send script so a send can never silently fail or fire twice.
 *
 *   import { abortIfAlreadySent, verifySent } from './ac-send-guard.mjs';
 */

/**
 * IDEMPOTENCY GUARD — call BEFORE creating/firing a campaign.
 * If a campaign with this exact name already exists with send_amt > 0, abort.
 * Prevents accidentally re-running a send script and double-sending.
 */
export async function abortIfAlreadySent(GET, campaignName) {
  const recent = await GET('/api/3/campaigns?orders[sdate]=DESC&limit=20');
  const hit = (recent.campaigns || []).find(
    c => c.name === campaignName && Number(c.send_amt) > 0
  );
  if (hit) {
    console.log(`GUARD: "${campaignName}" already sent (campaign #${hit.id}, send_amt=${hit.send_amt}, ldate=${hit.ldate}).`);
    console.log('GUARD: aborting to prevent a double-send. Delete/rename the prior campaign if you truly intend to resend.');
    process.exit(0);
  }
}

/**
 * COMPLETION GUARD — call AFTER firing. Polls until the campaign actually completes.
 * Throws (loudly, non-zero exit) if it is still a draft, never fires, or the
 * recipient count does not match what you intended to send.
 * Returns { ok, sent, campaign } on success.
 */
export async function verifySent(GET, campaignId, expectedCount, opts = {}) {
  const { timeoutMs = 120000, intervalMs = 6000 } = opts;
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = (await GET(`/api/3/campaigns/${campaignId}`)).campaign;
    const status = Number(last.status);
    if (status === 0) throw new Error(`GUARD FAIL: campaign #${campaignId} is still a DRAFT — it never fired.`);
    if (status === 5) {
      const sent = Number(last.send_amt);
      if (expectedCount != null && sent !== Number(expectedCount)) {
        throw new Error(`GUARD FAIL: campaign #${campaignId} completed but send_amt=${sent} != expected ${expectedCount}.`);
      }
      console.log(`GUARD ✓ campaign #${campaignId} COMPLETED, send_amt=${sent}${expectedCount != null ? ` (matches expected ${expectedCount})` : ''}.`);
      return { ok: true, sent, campaign: last };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`GUARD FAIL: campaign #${campaignId} never reached COMPLETED within ${timeoutMs / 1000}s (last status=${last?.status}, send_amt=${last?.send_amt}).`);
}
