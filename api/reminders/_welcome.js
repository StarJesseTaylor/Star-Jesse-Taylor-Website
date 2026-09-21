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
export async function catchUpWelcomes(sb, sendMessage, pickChannel, normalisePhone, log) {
  const out = { greeted: 0, failed: 0, detail: [] };
  try {
    // Active, consented, and with no outbound row at all.
    const res = await sb(
      'member_channel?select=id,first_name,phone,country_code,channel&status=eq.active&consent_at=not.is.null&limit=50'
    );
    if (!res.ok) return out;
    const members = await res.json();
    if (!members.length) return out;

    for (const m of members) {
      if (out.greeted + out.failed >= MAX_PER_RUN) break;

      // Has this member EVER been sent anything? One cheap count each.
      // 🛑 DO NOT FILTER ON status=eq.sent. That is the bug this shipped with,
      //    and it re-texted five people every sixty seconds.
      //    api/reminders/status.js moves a row forward through the Twilio
      //    lifecycle: sent -> delivered. So the moment the delivery receipt
      //    lands, the row is no longer 'sent', this lookup finds nothing, and
      //    the member is greeted again. Every minute. Forever.
      //    ANY outbound row means we have already contacted them.
      const seen = await sb(
        `message_log?select=id&member_id=eq.${m.id}&direction=eq.outbound&limit=1`
      );
      if (!seen.ok) continue;
      const rows = await seen.json().catch(() => []);
      if (rows.length) continue;                       // already greeted or already texted

      const phone = normalisePhone(m.phone, m.country_code);
      if (!phone.ok) { out.detail.push({ id: m.id, skipped: phone.reason }); continue; }

      const sent = await sendMessage({
        to: phone.e164,
        body: WELCOME,
        channel: m.channel || pickChannel(phone.e164),
      });

      if (sent.sent) {
        out.greeted++;
        out.detail.push({ name: m.first_name, sent: true });
        // Logged as a real sent message, which is what stops it repeating.
        await log(sb, m, { status: 'sent', body: WELCOME, provider_sid: sent.sid, meta: { kind: 'welcome', catch_up: true } });
      } else {
        out.failed++;
        out.detail.push({ name: m.first_name, error: sent.error });
      }
    }
  } catch (e) {
    out.detail.push({ error: String((e && e.message) || e).slice(0, 160) });
  }
  return out;
}
