// THE WELCOME TEXT, AND THE CATCH-UP THAT MAKES IT RELIABLE.
//
// Star's words, Sep 21. He added "save this number" himself, and it is the most
// useful line in it: a saved contact means every reminder after this arrives
// from "Star" rather than a number nobody recognises.
export const WELCOME =
  "This is Star. You're in. Save this number so you know it's me. " +
  "One text a day, random time, to get you out of your head and keep you on track. " +
  "Reply STOP whenever you want out.";

// WHY A CATCH-UP EXISTS AT ALL
// ---------------------------
// The welcome is sent by api/sms-optin.js the moment someone signs up. That is
// the right moment, and it is also a single point of failure: if the send fails
// for ANY reason, it never retries and that member is greeted by a reminder
// from an unknown number the next day.
//
// It already happened. Star's first five real members, in Austria, the UK,
// Sweden and Australia, all signed up while their countries were switched off
// on his Twilio account (Twilio ships every account US-only). Every welcome was
// refused, and all five sat with zero texts.
//
// So the cron now checks for anyone active who has never received anything, and
// sends it. Self-healing, like the inbound webhook: the system notices and
// fixes it rather than waiting for a human to spot it.

const MAX_PER_RUN = 10;   // a burst cap, so a bad day can never become a blast

// NOBODY IS WELCOMED IN THEIR SLEEP.
// Reminders already obey a local 8am-9pm window. This did not, so Ghazaal's
// first ever text from Star arrived at 3am in Perth and she opted out. Star,
// afterwards: "It is not the middle of the night for her. It is the middle of
// the night for me." A welcome that waits until morning costs nothing.
const AWAKE_FROM = 8;     // local hour
const AWAKE_UNTIL = 21;   // local hour

/**
 * Greet anyone active who has never received a single text.
 *
 * "Never received anything" is the test on purpose: it needs no new column and
 * it cannot double-greet, because the welcome itself is logged as a sent
 * message, which takes them out of the set immediately.
 *
 * Never throws. A failure here must not stop the day's reminders going out.
 *
 * @returns {Promise<{greeted:number, failed:number, detail:Array}>}
 */
/**
 * Welcome ONE member, at most once, ever.
 *
 * 🛑 THIS IS THE ONLY PLACE A WELCOME IS EVER SENT.
 *
 *    It used to have two. api/sms-optin.js texted people the moment they
 *    signed up, and never wrote a row to message_log. The cron then looked for
 *    a welcome row, found none, and sent its own. Two texts, sixty seconds
 *    apart, on the single occasion a new member is judging whether this thing
 *    is worth staying in. The signup path now calls this function instead, so
 *    the check and the record are the same code for both.
 *
 * @returns {Promise<{sent:boolean, skipped?:string, error?:string}>}
 */
export async function greetOnce(sb, sendMessage, { memberId, toE164, channel }) {
  // TWO QUESTIONS, IN THIS ORDER.
  //
  // 1. Have we already TRIED to welcome them? Any row tagged as a welcome
  //    counts, whatever became of it. This is what makes a second welcome
  //    impossible, and it must ignore status entirely: status.js walks a row
  //    forward through Twilio's lifecycle (sent -> delivered), so the original
  //    `status=eq.sent` check stopped matching the moment the receipt landed
  //    and re-texted five people every sixty seconds.
  //    A welcome that FAILED also counts, deliberately: a blocked country would
  //    otherwise retry every minute forever. Star gets told instead.
  const greeted = await sb(
    `message_log?select=id&member_id=eq.${memberId}&direction=eq.outbound` +
    `&meta->>kind=eq.welcome&limit=1`
  );
  if (!greeted.ok) return { sent: false, skipped: 'could not check the history' };
  if ((await greeted.json().catch(() => [])).length) return { sent: false, skipped: 'already greeted' };

  // 2. Have they had a real text from us by some other route? Then a welcome
  //    now would be odd, so leave them alone.
  //    🛑 "Any outbound row" is NOT the test, which is how Hana went two days
  //    with nothing. A jammed send cap wrote her 42 failed rows, every one of
  //    them looked like contact, and she became permanently ineligible for the
  //    greeting she had never received. Only a text that actually left counts,
  //    and only Twilio handing back a SID proves that.
  const texted = await sb(
    `message_log?select=id&member_id=eq.${memberId}&direction=eq.outbound` +
    `&provider_sid=not.is.null&limit=1`
  );
  if (!texted.ok) return { sent: false, skipped: 'could not check the history' };
  if ((await texted.json().catch(() => [])).length) return { sent: false, skipped: 'already texted' };

  // 🛑 CLAIM BEFORE SENDING. This is the whole guarantee.
  //
  //    Every version of this that sent first and logged after could send twice,
  //    because anything between the two (a crash, a timeout, a status that
  //    changed underneath us) leaves no record and the next run starts over.
  //    That is how five welcomes happened.
  //
  //    Writing the row FIRST inverts the failure mode. The worst case stops
  //    being "texts them repeatedly" and becomes "misses one welcome", which is
  //    recoverable and which Star is told about.
  //
  //    The row stays even if the send then fails. That is deliberate: a blocked
  //    country would otherwise retry every minute forever. Star gets an email
  //    naming the person, and a retry becomes a decision rather than a loop.
  const claim = await sb('message_log', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      member_id: memberId, type: 'reminder', direction: 'outbound',
      status: 'welcome_sending', body: WELCOME,
      meta: { kind: 'welcome', claimed_at: new Date().toISOString() },
    }),
  });
  if (!claim.ok) return { sent: false, skipped: 'could not claim' };
  const claimed = (await claim.json().catch(() => []))[0];

  const out = await sendMessage({ to: toE164, body: WELCOME, channel, kind: 'welcome' });

  // Settle the row we already own. Never insert a second one.
  if (claimed?.id) {
    await sb(`message_log?id=eq.${claimed.id}`, {
      method: 'PATCH',
      body: JSON.stringify(
        out.sent
          ? { status: 'sent', provider_sid: out.sid }
          : { status: 'error', meta: { kind: 'welcome', error: String(out.error || '').slice(0, 200), from: out.from } }
      ),
    }).catch(() => {});
  }

  return out.sent ? { sent: true } : { sent: false, error: out.error };
}

/**
 * Greet anyone active who has never been greeted.
 *
 * Never throws. A failure here must not stop the day's reminders going out.
 *
 * @returns {Promise<{greeted:number, failed:number, detail:Array}>}
 */
export async function catchUpWelcomes(sb, sendMessage, pickChannel, normalisePhone, log, localMinutesNow) {
  const out = { greeted: 0, failed: 0, detail: [] };
  try {
    const res = await sb(
      'member_channel?select=id,first_name,phone,country_code,channel,timezone&status=eq.active&consent_at=not.is.null&limit=50'
    );
    if (!res.ok) return out;
    const members = await res.json();
    if (!members.length) return out;

    for (const m of members) {
      if (out.greeted + out.failed >= MAX_PER_RUN) break;

      // Their clock, never Star's. Checked before anything else so a sleeping
      // member costs one comparison instead of two database round trips.
      if (typeof localMinutesNow === 'function') {
        let hour = null;
        try { hour = Math.floor(localMinutesNow(m.timezone || 'UTC') / 60); } catch { hour = null; }
        if (hour !== null && (hour < AWAKE_FROM || hour >= AWAKE_UNTIL)) {
          out.detail.push({ name: m.first_name, waiting: 'asleep, local hour ' + hour });
          continue;
        }
      }

      const phone = normalisePhone(m.phone, m.country_code);
      if (!phone.ok) { out.detail.push({ id: m.id, skipped: phone.reason }); continue; }

      const r = await greetOnce(sb, sendMessage, {
        memberId: m.id,
        toE164: phone.e164,
        channel: m.channel || pickChannel(phone.e164),
      });

      if (r.sent) { out.greeted++; out.detail.push({ name: m.first_name, sent: true }); }
      else if (r.error) { out.failed++; out.detail.push({ name: m.first_name, error: r.error }); }
      else out.detail.push({ name: m.first_name, skipped: r.skipped });
    }
  } catch (e) {
    out.detail.push({ error: String((e && e.message) || e).slice(0, 160) });
  }
  return out;
}
