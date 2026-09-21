// THE LAST LINE BEFORE THE WIRE.
//
// WHY THIS EXISTS
// ---------------
// On 21 Sep 2026 a welcome catch-up I wrote checked whether someone had
// already been texted by looking for a log row with status 'sent'. Twilio's
// delivery receipt then moves that same row to 'delivered', so the check
// stopped matching, the member looked untexted again, and the cron sent
// another. Every sixty seconds. Esra, Firdaus and Mel got five each, Ghazaal
// got four at 3am in Perth and opted out.
//
// One wrong word, twenty texts, one member lost.
//
// THE POINT OF THIS FILE
// ----------------------
// Every path that sends a text calls sendMessage(). If the guard lives HERE,
// no mistake in any caller can produce a burst: not the reminder loop, not the
// welcome, not anything added later by someone who has not read this. The
// calling code does not have to be right. The wire refuses.
//
// This is deliberately NOT clever. It does not try to understand intent, it
// counts what the person has already received and stops at a number that no
// legitimate feature should ever reach.
//
//   2 per hour  - a welcome plus a reminder is 2. Anything more is a bug.
//   2 per day   - Star, after seeing Esra's first real reminder land:
//                 "Can you make sure that they don't get more than one a day?"
//                 One reminder is the product. Two is only ever the signup day,
//                 where the welcome lands and then the day's reminder follows.
//                 A third in one day cannot be anything but a fault.
//
// RAISE IT BY ENV, NEVER BY EDITING THE DEFAULT. If the paid tier ever offers
// 3 a day, set SMS_MAX_PER_DAY in Vercel to 4 (their three plus a welcome).
// The default stays at the promise made to a member today.
//
// FAILS CLOSED. If the count cannot be read, nothing sends. A missed reminder
// is recoverable and a member texts once more tomorrow. A burst costs a person.
// This costs nothing extra in practice: the cron already reads its member list
// from the same database, so if that is down there is nothing to send anyway.

const SB_URL = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export const PER_HOUR = Number(process.env.SMS_MAX_PER_HOUR || 2);
export const PER_DAY = Number(process.env.SMS_MAX_PER_DAY || 2);

const sb = (path) =>
  fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

const countFrom = async (res) => {
  if (!res.ok) return null;
  const cr = res.headers.get('content-range') || '';   // "0-0/12"
  const n = Number(cr.split('/')[1]);
  return Number.isFinite(n) ? n : null;
};

/**
 * May we text this number right now?
 *
 * Counts by PHONE, not by member id, because a number is the thing a human
 * holds. Two member rows pointing at one phone must not double the allowance.
 *
 * @returns {Promise<{allow:boolean, reason?:string, lastHour?:number, lastDay?:number}>}
 */
export async function maySend(toE164) {
  if (!SB_URL() || !SB_KEY()) {
    return { allow: false, reason: 'cannot check the send history, refusing rather than risking a burst' };
  }
  try {
    const who = await fetch(
      `${SB_URL()}/rest/v1/member_channel?phone=eq.${encodeURIComponent(toE164)}&select=id`,
      { headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` } }
    );
    if (!who.ok) return { allow: false, reason: 'could not look up the member, refusing' };
    const rows = await who.json().catch(() => []);
    // Not a member of the reminder system at all (a one-off or a test send).
    // Nothing to count against, so let it through.
    if (!rows.length) return { allow: true };

    const ids = rows.map((r) => r.id);
    const inList = `in.(${ids.join(',')})`;
    const since = (mins) => new Date(Date.now() - mins * 60_000).toISOString();

    const hour = await countFrom(await sb(
      `message_log?select=id&member_id=${inList}&direction=eq.outbound&created_at=gte.${encodeURIComponent(since(60))}`
    ));
    if (hour === null) return { allow: false, reason: 'could not count recent texts, refusing' };
    if (hour >= PER_HOUR) {
      return { allow: false, lastHour: hour, reason: `already had ${hour} texts in the last hour, limit is ${PER_HOUR}` };
    }

    const day = await countFrom(await sb(
      `message_log?select=id&member_id=${inList}&direction=eq.outbound&created_at=gte.${encodeURIComponent(since(1440))}`
    ));
    if (day === null) return { allow: false, reason: 'could not count today, refusing' };
    if (day >= PER_DAY) {
      return { allow: false, lastHour: hour, lastDay: day, reason: `already had ${day} texts today, limit is ${PER_DAY}` };
    }

    return { allow: true, lastHour: hour, lastDay: day };
  } catch (e) {
    return { allow: false, reason: 'send-cap check failed: ' + String((e && e.message) || e).slice(0, 120) };
  }
}

/**
 * The cap tripping means something upstream is wrong. Say so, loudly, once an
 * hour per number, because a broken loop would otherwise email as fast as it
 * texts.
 */
const told = new Map();
export async function reportCapHit(toE164, guard) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const last = told.get(toE164) || 0;
  if (Date.now() - last < 3600_000) return;
  told.set(toE164, Date.now());
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
        to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
        subject: '🛑 A text was blocked before it sent',
        html:
          `<p>Something tried to text <strong>${String(toE164).replace(/[<>&]/g, '')}</strong> more than it should, and it was stopped.</p>` +
          `<p><strong>${String(guard.reason || '').replace(/[<>&]/g, '')}</strong></p>` +
          `<p>Nobody was spammed. This is the guard doing its job, but it means something upstream is wrong and worth looking at.</p>`,
      }),
    }).catch(() => {});
  } catch { /* never let an alert break a send path */ }
}
