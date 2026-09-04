// SELF-HEAL THE REPLY WEBHOOK.
//
// WHY THIS EXISTS
// ---------------
// If Twilio's SmsUrl is not pointed at /api/reminders/inbound, a member who
// texts back gets silence. Their STOP still works (Twilio honours that at the
// account level on its own) but their actual words never reach us — which is
// the single most valuable thing a test produces.
//
// Fixing it was a five-click job in the Twilio console, and it sat undone for
// weeks because Star could not log in. He does not need to. The credentials
// are already in Vercel, so the cron can just set it itself.
//
// SAFETY
//   • Only ever writes OUR url onto OUR number. Reads everything first.
//   • Idempotent — if it is already right, it does nothing and says so.
//   • Runs at most once per cold start, and never blocks a send.
//   • Emails Star the one time it actually changes something.

const SITE = () => (process.env.SITE_URL || 'https://starjessetaylor.com').replace(/\/$/, '');

// Module scope: survives warm invocations, resets on cold start. Means a
// per-minute cron makes at most a couple of extra Twilio calls a day.
let checked = false;

function auth() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, header: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') };
}

/**
 * Make sure replies reach us. Safe to call on every request.
 * @param {boolean} force  ignore the once-per-cold-start guard
 * @returns {Promise<{state:string, detail?:string, number?:string}>}
 */
export async function healInboundWebhook(force = false) {
  if (checked && !force) return { state: 'skipped', detail: 'already checked this cold start' };
  checked = true;

  const a = auth();
  if (!a) return { state: 'no-creds' };

  const want = SITE() + '/api/reminders/inbound';

  try {
    const listRes = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + a.sid + '/IncomingPhoneNumbers.json?PageSize=20',
      { headers: { Authorization: a.header } }
    );
    if (!listRes.ok) return { state: 'error', detail: 'could not list numbers: ' + listRes.status };
    const data = await listRes.json().catch(() => ({}));
    const nums = data.incoming_phone_numbers || [];
    if (!nums.length) return { state: 'no-number' };

    const configured = process.env.TWILIO_FROM_NUMBER;
    const target = nums.find(n => n.phone_number === configured) || nums[0];

    if (target.sms_url === want) {
      return { state: 'already-ok', number: target.phone_number };
    }

    const body = new URLSearchParams({ SmsUrl: want, SmsMethod: 'POST' });
    const patch = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + a.sid + '/IncomingPhoneNumbers/' + target.sid + '.json',
      {
        method: 'POST',
        headers: { Authorization: a.header, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }
    );
    if (!patch.ok) {
      const e = await patch.json().catch(() => ({}));
      return { state: 'error', detail: 'Twilio refused: ' + (e.message || patch.status) };
    }
    const after = await patch.json().catch(() => ({}));

    // Tell Star once, because this is a change to his account that he did not
    // click. Import lazily so a Resend problem can never break the send path.
    try {
      const { alertStarThrottled } = await import('./_notify.js');
      await alertStarThrottled({
        kind: 'webhook_pointed',
        subject: '✅ Text replies now reach you',
        html:
          '<p>Your Twilio number <strong>' + target.phone_number + '</strong> was not set up to deliver replies ' +
          'anywhere, so anything a member texted back would have vanished.</p>' +
          '<p>It is now pointed at <code>' + after.sms_url + '</code>, which means STOP, HELP and ordinary ' +
          'replies all reach the site and get logged.</p>' +
          '<p>Nothing else on the number was changed, and you do not need to do anything.</p>',
        detail: { number: target.phone_number, sms_url: after.sms_url, was: target.sms_url || null },
        throttleMinutes: 24 * 60,
      });
    } catch { /* notification is a nicety, never a blocker */ }

    return { state: 'fixed', number: target.phone_number, detail: after.sms_url };
  } catch (e) {
    return { state: 'error', detail: String((e && e.message) || e).slice(0, 200) };
  }
}
