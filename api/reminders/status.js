// THE RECEIPTS — /api/reminders/status
//
// Twilio calls this a few seconds after every live send with what actually
// happened to the message. Nobody's phone rings; it is one server telling
// another, and the result lands in message_log.status.
//
// WHY IT EXISTS
// -------------
// The Twilio API response to a send says `queued`. That means Twilio accepted
// the string — NOT that a phone received it. US A2P traffic gets silently
// FILTERED by carriers: the message is dropped, no bounce, no error on the send
// call. Without this endpoint the logs read "30 sent, all good" while nineteen
// people got nothing, and there is no way to tell the difference.
//
// STATUS LIFECYCLE (SMS)
//   queued -> sent -> delivered
//                  -> undelivered   (carrier rejected it — ErrorCode says why)
//                  -> failed        (never left Twilio)
// WhatsApp adds `read`. We record whatever arrives.
//
// THE ERROR CODES THAT MATTER
//   30003 unreachable handset        30005 unknown/inactive number
//   30006 landline or unreachable    30007 CARRIER FILTERED (spam) <- the silent killer
//   30008 unknown error              21610 they replied STOP; we are blocked
//   30034 number not registered to an A2P 10DLC campaign
//
// Twilio does not meaningfully retry status callbacks, so this always answers
// 204 fast and never throws.

import { verifyTwilio } from './_twilio-sig.js';
import { alertStarThrottled, escapeHtml } from './_notify.js';

const SB_URL = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = (path, init = {}) =>
  fetch(`${SB_URL()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

// Statuses that mean the human did not get it.
const BAD = new Set(['undelivered', 'failed']);

// Plain-English cause, so Star's inbox doesn't say "30007".
const WHY = {
  '30003': 'their phone is off, out of range, or blocking us',
  '30005': 'that number is unknown or no longer active',
  '30006': "it's a landline, or can't receive texts",
  '30007': 'THE CARRIER FILTERED IT AS SPAM — this is the one that quietly kills SMS programs',
  '30008': 'unknown carrier error',
  '21610': 'they replied STOP, so Twilio is blocking us (this one is correct behaviour)',
  '30034': 'the number is not registered to an approved A2P 10DLC campaign',
  '63016': 'WhatsApp: outside the 24-hour window and no approved template',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // 🛑 Anyone could POST "delivered" here and poison the numbers. Prove it's Twilio.
  const sig = verifyTwilio(req);
  if (!sig.ok) {
    await alertStarThrottled({
      kind: 'sig_reject_status',
      subject: '⚠️ Reminder engine: a status callback failed its signature check',
      html:
        `<p>Something POSTed to <code>/api/reminders/status</code> and could not be proven to be Twilio.</p>` +
        `<p><strong>Reason:</strong> ${escapeHtml(sig.reason || 'unknown')}</p>` +
        `<p>If you just changed the callback URL in Twilio, this is expected — fix the URL and it stops. ` +
        `If you changed nothing, someone is poking at the endpoint. Either way no data was written.</p>`,
      detail: { reason: sig.reason },
      throttleMinutes: 120,
    });
    return res.status(403).end();
  }

  const sid = String(req.body?.MessageSid || req.body?.SmsSid || '');
  const status = String(req.body?.MessageStatus || req.body?.SmsStatus || '').toLowerCase();
  const errorCode = req.body?.ErrorCode ? String(req.body.ErrorCode) : null;

  if (!sid || !status) return res.status(204).end();
  if (!SB_URL() || !SB_KEY()) return res.status(204).end();

  try {
    // Attach the outcome to the row we wrote when we sent it.
    //
    // We only ever move FORWARD through the lifecycle. Twilio callbacks can
    // arrive out of order (`sent` landing after `delivered` on a slow retry),
    // and overwriting `delivered` with `sent` would make a delivered message
    // look pending forever. `status=neq.delivered` is the cheap version of that
    // guard — once it's delivered, nothing may downgrade it.
    const r = await sb(
      `message_log?provider_sid=eq.${encodeURIComponent(sid)}&status=neq.delivered`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ status }),
      }
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];

    // Record the error code separately so we never clobber the meta written at
    // send time (line id, slot, channel). PostgREST has no JSON merge, so read
    // -modify-write on just the row we matched.
    if (errorCode && rows.length) {
      const row = rows[0];
      const meta = { ...(row.meta || {}), error_code: errorCode, error_why: WHY[errorCode] || null };
      await sb(`message_log?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ meta }),
      }).catch(() => {});
    }

    // ── The one time this endpoint is allowed to interrupt Star. ──
    // Not "a text failed" — texts fail, phones die. Only when the failure rate
    // over the last 24h crosses a line that means something is actually wrong.
    if (BAD.has(status)) await maybeAlertOnFailureRate(errorCode);
  } catch {
    // Never throw at Twilio. A 500 here just makes Twilio retry into the same wall.
  }

  return res.status(204).end();
}

/**
 * Look at the last 24 hours. Alert only if there is enough volume for a rate to
 * mean anything AND the rate is bad. Sending three texts and having one fail is
 * not a story; sending eighty and having twenty-five fail is.
 */
async function maybeAlertOnFailureRate(latestErrorCode) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const base = `message_log?direction=eq.outbound&created_at=gte.${encodeURIComponent(since)}`;

  const count = async (q) => {
    const r = await sb(`${q}&select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    const cr = r.headers.get('content-range') || '';        // "0-0/123"
    return Number(cr.split('/')[1] || 0);
  };

  const total = await count(base);
  if (total < 20) return;                                    // too few to judge

  const bad = await count(`${base}&status=in.(undelivered,failed)`);
  const rate = bad / total;
  if (rate < 0.15) return;                                   // under 15% is normal noise

  await alertStarThrottled({
    kind: 'delivery_failure_rate',
    subject: `🚨 Reminders: ${Math.round(rate * 100)}% are not reaching phones`,
    html:
      `<p><strong>${bad} of the last ${total} texts did not get delivered.</strong> ` +
      `That's ${Math.round(rate * 100)}% in 24 hours.</p>` +
      (latestErrorCode
        ? `<p><strong>Most recent reason (${escapeHtml(latestErrorCode)}):</strong> ${escapeHtml(WHY[latestErrorCode] || 'unrecognised code')}</p>`
        : '') +
      `<p>If the code is <strong>30007</strong>, carriers are filtering the messages as spam — ` +
      `check the A2P campaign is still approved and the number is still attached to it. ` +
      `If it's <strong>30034</strong>, the number came off the campaign entirely.</p>` +
      `<p>Nothing is broken on the site. The texts are being sent; phone carriers are dropping them.</p>`,
    detail: { bad, total, rate, latestErrorCode },
    throttleMinutes: 12 * 60,
  });
}
