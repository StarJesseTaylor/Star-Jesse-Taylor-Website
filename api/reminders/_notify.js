// TELLING STAR — email, but only when it earns the interruption.
//
// The rule for this whole engine: SILENT WHEN IT WORKS, LOUD WHEN IT DOESN'T.
// A notification for every delivered text is 200 emails a day and Star stops
// reading them, which means the one that matters gets missed too.
//
// Everything here is throttled through message_log so a flood of failures (or a
// bot hammering a webhook) produces ONE email, not four hundred.

const SB_URL = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function sb(path, init = {}) {
  return fetch(`${SB_URL()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

/**
 * Have we already logged an alert of this kind recently?
 * Uses message_log as the throttle store so there's no new table and the
 * history of "how often did this break" is queryable after the fact.
 */
async function alertedRecently(kind, withinMinutes) {
  if (!SB_URL() || !SB_KEY()) return false;         // can't throttle -> don't block the alert
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString();
  try {
    const r = await sb(
      `message_log?select=id&classification=eq.${encodeURIComponent(kind)}` +
      `&created_at=gte.${encodeURIComponent(since)}&limit=1`
    );
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return rows.length > 0;
  } catch { return false; }
}

async function logAlert(kind, detail) {
  if (!SB_URL() || !SB_KEY()) return;
  await sb('message_log', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'inbound',
      classification: kind,
      status: 'alert',
      body: null,
      meta: detail || {},
    }),
  }).catch(() => {});
}

function escapeHtml(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

/**
 * Email Star, at most once per `throttleMinutes` for a given `kind`.
 * @returns {Promise<boolean>} true if an email actually went out.
 */
export async function alertStarThrottled({ kind, subject, html, detail, throttleMinutes = 60 }) {
  if (await alertedRecently(kind, throttleMinutes)) return false;

  // Log BEFORE sending. If Resend is down we still want the throttle to hold,
  // otherwise every subsequent request retries the email and we hammer Resend.
  await logAlert(kind, detail);

  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
      to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
      subject,
      html,
    }),
  }).catch(() => null);

  return !!(r && r.ok);
}

export { escapeHtml };
