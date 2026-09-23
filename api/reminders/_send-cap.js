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

// ONE REMINDER A DAY. Star, three times over two days: "make sure they get one
// reminder message a day", "just one text a day".
//
// Every member is already set to frequency 1, and the schedule table claims a
// slot per day so a second run cannot resend it. This is the third lock, and
// the only one that does not depend on any of that being correct.
//
// It counts the member's OWN calendar day, passed in by the caller, never a
// rolling 24 hours. A rolling window would refuse a legitimate text: slots are
// random between 8am and 9pm, so yesterday's 8:50pm and today's 8:10am are
// thirteen hours apart and both are right.
export const REMINDERS_PER_DAY = Number(process.env.SMS_MAX_REMINDERS_PER_DAY || 1);

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
 * @param {string} toE164
 * @param {{kind?:string, dayStartISO?:string}} [opts]
 *        kind 'reminder' adds the one-a-day rule. dayStartISO is midnight in
 *        THEIR timezone, expressed as UTC, because only the caller knows it.
 *        from is the number we are about to send from, so a sender that has
 *        changed since a 21612 failure lifts the unreachable block by itself.
 * @returns {Promise<{allow:boolean, reason?:string, lastHour?:number, lastDay?:number}>}
 */
export async function maySend(toE164, opts = {}) {
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

    // 🛑 COUNT ONLY TEXTS THAT ACTUALLY REACHED A PHONE.
    //    First version counted every outbound row, and every BLOCKED attempt is
    //    itself logged as an outbound row. So each refusal raised the count,
    //    which guaranteed the next refusal: the counter ate its own output and
    //    told Star's members "already had 19 texts in the last hour" when they
    //    had received five. Hana and Mel had twenty real reminders blocked by
    //    it before this was caught.
    //
    //    EXCLUDE the failures rather than include the successes. Excluding is
    //    stable: 'sent' becomes 'delivered' when the receipt lands, and an
    //    include-list would break on that exactly like the welcome dedupe did.
    //    A status we have never seen before counts as a send, which is the safe
    //    direction to be wrong in.
    //
    //    🛑 AND MIND THE QUOTES. The first attempt at this fix wrote
    //    not.in.('error','dropped_stale',...) with SQL-style single quotes.
    //    PostgREST does not use single quotes: it read them as part of the
    //    value, matched a status literally called "'error'", excluded nothing,
    //    and the jam carried straight on. Hana sat at zero texts for another
    //    full day while the log climbed "already had 19 texts in the last
    //    hour". Bare words here, or double quotes. Never single.
    //
    //    The real test is provider_sid: Twilio hands back a message SID only
    //    when a text actually left. A blocked attempt has none. That is a fact
    //    about the send rather than a name we chose, so it cannot drift the way
    //    a status list can.
    const NOT_A_SEND = '(error,dropped_stale,dry_run,failed,undelivered)';
    const realSends = (mins) =>
      `message_log?select=id&member_id=${inList}&direction=eq.outbound` +
      `&provider_sid=not.is.null` +
      `&status=not.in.${NOT_A_SEND}` +
      `&created_at=gte.${encodeURIComponent(since(mins))}`;

    const hour = await countFrom(await sb(realSends(60)));
    if (hour === null) return { allow: false, reason: 'could not count recent texts, refusing' };
    if (hour >= PER_HOUR) {
      return { allow: false, lastHour: hour, reason: `already had ${hour} texts in the last hour, limit is ${PER_HOUR}` };
    }

    const day = await countFrom(await sb(realSends(1440)));
    if (day === null) return { allow: false, reason: 'could not count today, refusing' };
    if (day >= PER_DAY) {
      return { allow: false, lastHour: hour, lastDay: day, reason: `already had ${day} texts today, limit is ${PER_DAY}` };
    }

    // 🛑 DO NOT KEEP KNOCKING ON A DOOR THAT IS BRICKED UP.
    //
    //    Twilio scores every account on messaging health, and a wall of failed
    //    sends drags down "sent rate" and "fraud" together, because a US number
    //    firing repeatedly at unreachable foreign numbers is the exact shape of
    //    an SMS pumping attack. Star's score fell 31 points in a week, to 66,
    //    off the back of 60 errors that were all the same error.
    //
    //    Error 21612 means the destination cannot be reached FROM THIS NUMBER.
    //    It is not a glitch and it will not pass. Retrying it daily costs us
    //    reputation for nothing, and reputation is what decides whether the
    //    texts that DO work keep landing.
    //
    //    So: if this member hit 21612 recently, we stop. But only while the
    //    sender is the same one that failed. The moment a number is bought in
    //    their country and TWILIO_FROM_<ISO> is set, `from` differs, the guard
    //    lifts by itself, and they are retried on the next run. No redeploy, no
    //    database surgery, no remembering to undo anything.
    const walled = await fetch(
      `${SB_URL()}/rest/v1/message_log?select=meta,created_at&member_id=${inList}` +
      `&meta->>error=like.*21612*&created_at=gte.${encodeURIComponent(since(60 * 24 * 7))}` +
      `&order=created_at.desc&limit=1`,
      { headers: { apikey: SB_KEY(), Authorization: `Bearer ${SB_KEY()}` } }
    ).catch(() => null);
    if (walled && walled.ok) {
      const hit = (await walled.json().catch(() => []))[0];
      const failedFrom = hit && hit.meta && hit.meta.from;
      // No recorded sender means the row predates this guard. Treat it as the
      // number we are using now, which is the safe reading: it blocks.
      if (hit && (!failedFrom || failedFrom === opts.from)) {
        return {
          allow: false,
          reason: 'this number cannot be reached from ' + (opts.from || 'our number') +
                  ' (Twilio 21612). Buy a number in their country and set TWILIO_FROM_<ISO> to reach them.',
        };
      }
    }

    // THE ONE-A-DAY RULE, for reminders only. A welcome is not a reminder and
    // must never be counted as one, or a member who signs up in the morning
    // would lose their first day's text to their own hello.
    //
    // A reminder is a row with a line_id: it names which of the 30 lines was
    // sent. The welcome has none. That is structural, so it cannot drift the
    // way a status name or a meta tag can.
    if (opts.kind === 'reminder') {
      const from = opts.dayStartISO || since(1440);
      const q = realSends(0).replace(
        /&created_at=gte\.[^&]*/,
        '&created_at=gte.' + encodeURIComponent(from)
      ) + '&line_id=not.is.null';
      const today = await countFrom(await sb(q));
      if (today === null) return { allow: false, reason: "could not count today's reminders, refusing" };
      if (today >= REMINDERS_PER_DAY) {
        return { allow: false, lastDay: day, reason: `already had ${today} reminder(s) today, and the promise is ${REMINDERS_PER_DAY} a day` };
      }
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
