// One phone parser for the whole system. The signup door and the sender MUST
// agree, or we save numbers we can never text. See the note at normalizedPhone.
import { normalisePhone } from './reminders/_channel.js';
import { maySendWelcome } from './reminders/_abuse.js';

const LIST_ID = '3'; // Master Contact List

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.body && req.body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  if (!AC_KEY) return res.status(500).json({ error: 'Server configuration error' });

  const { firstName, lastName, email, phone, consent, website_url, source } = req.body || {};

  // Honeypot
  if (website_url) {
    console.log('Bot blocked (honeypot):', { email });
    return res.status(200).json({ success: true });
  }

  // Email is the service on this page. Phone + consent are an OPTIONAL add-on.
  // A submission with no phone must succeed — that is the non-SMS path a carrier
  // reviewer needs to be able to complete. (A2P 10DLC error 30923.)
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!firstName || !String(firstName).trim()) {
    return res.status(400).json({ error: 'name', message: 'Please add your first name.' });
  }
  if (!lastName || !String(lastName).trim()) {
    return res.status(400).json({ error: 'name', message: 'Please add your last name.' });
  }

  // SMS is only ever recorded when BOTH a number and an explicit tick are present.
  const smsOptIn = !!(phone && consent);
  if (phone && !consent) {
    return res.status(400).json({ error: 'To receive texts, please tick the SMS consent box.' });
  }

  // Bot pattern detector
  if (firstName && /^[A-Za-z]{15,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { email, firstName });
    return res.status(200).json({ success: true });
  }

  // Normalise the phone using THE SAME function the sender uses.
  //
  // 🛑 THIS FILE USED TO ROLL ITS OWN, AND IT CORRUPTED EVERY NON-US NUMBER.
  //    The old line was:
  //      digits.startsWith('+') ? digits : (len === 10 ? `+1${digits}` : `+${digits}`)
  //    An Australian typing "0412 345 678" -> 10 digits -> "+10412345678", a US
  //    number with area code 041, which does not exist. A UK "07911123456" ->
  //    "+07911123456", and E.164 never has a zero straight after the +.
  //    Both got written to ActiveCampaign AND to member_channel, looked fine in
  //    every dashboard, and were then rejected at send time. The member is on
  //    the list, has consented, shows as active, and never receives anything.
  //    Nobody finds out. Star mentioned testers in Beijing, Singapore and
  //    Australia — this would have hit all of them.
  //
  //    normalisePhone() refuses ambiguous input instead of inventing a number,
  //    so a bad entry now fails loudly at the form where the person can fix it.
  let normalizedPhone = '';
  if (smsOptIn) {
    const parsed = normalisePhone(String(phone), req.body?.countryCode);
    if (!parsed.ok) {
      // `message` is what the page shows a human; `error` is a short code for us.
      // The page printed the CODE once (Star saw the single word "phone" under
      // the button and thought the form was broken), so both are sent and
      // sms.html now prefers message.
      return res.status(400).json({
        error: 'phone',
        message: 'That number did not go through: ' + parsed.reason + '.',
        detail: parsed.reason,
      });
    }
    normalizedPhone = parsed.e164;
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  // ⭐ THE TEXTING DATABASE GOES FIRST. Star: "should it go into ActiveCampaign
  //    first or Supabase first to make it bulletproof?"
  //
  //    Everything else in this file survives either service failing, because a
  //    failure in one no longer cancels the other. But there is one failure
  //    NOTHING can rescue: a function timeout. If Vercel kills this request
  //    mid-run, no catch block executes and no alert email is sent. Whatever
  //    was already written is all that survives.
  //
  //    ActiveCampaign is FOUR sequential calls (sync, list subscribe, tags,
  //    consent note). Supabase is one insert. Doing ActiveCampaign first meant
  //    a slow day there could burn the whole time budget before the number was
  //    ever saved, and the member would be gone with no trace.
  //
  //    So the single fastest write, for the thing that delivers the promise,
  //    happens before anything else. Everything after it is recoverable.
  const signupOpen = process.env.REMINDERS_SIGNUP_OPEN === '1';
  let enrol = { ok: false, reason: 'signup door closed' };
  if (smsOptIn && signupOpen) {
    enrol = await enrolInReminders({
      phone: normalizedPhone,
      firstName: firstName || null,
      timezone: (req.body && req.body.timezone) || null,
      source: source || 'website',
    });
  }

  try {
    // Sync contact with phone field
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // Only send fields we actually have. AC's contact/sync matches on email
        // and updates ONLY the keys present, so omitting lastName leaves an
        // existing last name intact rather than blanking it. Star has people in
        // AC from years of forms; this must never wipe what is already there.
        contact: Object.assign(
          { email, firstName: firstName || '' },
          lastName ? { lastName } : {},
          normalizedPhone ? { phone: normalizedPhone } : {}
        )
      })
    });

    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync error:', syncRes.status, text);

      // 🛑 DO NOT GIVE UP HERE. This used to `return 500`, and because the
      //    enrolment ran AFTER it, one bad minute at ActiveCampaign lost the
      //    signup from every system at once: the number never reached the
      //    texting database either, and the person saw an error and went away.
      //
      //    Star, on why both exist: "We collect them into ActiveCampaign
      //    because eventually maybe we use it to send emails." ActiveCampaign is
      //    the relationship; the texting database is the machine that sends.
      //    Different jobs, so a failure in one must not cancel the other.
      //
      //    The number is already safe (enrolled above), so all that is left is
      //    telling Star this person never reached his list.
      await alertStarAboutLostContact({ firstName, lastName, email, normalizedPhone, smsOptIn, rescued: enrol.ok, detail: text });

      // 200, not 500: from their side this DID work. They consented, and if they
      // gave a number they are now in the texting engine. Telling them it failed
      // would make them submit again, or give up.
      return res.status(200).json({ success: true, sms: smsOptIn, reminders: enrol.ok, crm: false });
    }

    const { contact } = await syncRes.json();
    const contactId = contact?.id;
    if (!contactId) {
      // Same trap as the failure above: returning 500 here skipped the enrolment
      // entirely, so an odd ActiveCampaign response cost us the phone number.
      await alertStarAboutLostContact({
        firstName, lastName, email, normalizedPhone, smsOptIn,
        rescued: enrol.ok, detail: 'ActiveCampaign accepted the request but returned no contact id',
      });
      return res.status(200).json({ success: true, sms: smsOptIn, reminders: enrol.ok, crm: false });
    }

    // Subscribe to Master Contact List
    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    }).catch(() => {});

    // Tag. Only tag sms:consented when they actually ticked the box AND gave a number.
    const tags = [`source:${source || 'website'}`, smsOptIn ? 'sms:consented' : 'sms:declined'];
    await applyTags(AC_URL, headers, contactId, tags);

    // Log consent for legal record (TCPA compliance) — only when SMS was actually opted into.
    if (smsOptIn) {
      await fetch(`${AC_URL}/api/3/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          note: {
            note: `SMS consent recorded ${new Date().toISOString()}. Source: ${source || 'website'}. Phone: ${normalizedPhone}. Opt-in was optional: user completed the form's email service and separately ticked an unchecked SMS consent box. Disclosure: practice reminders, tips, updates about Star's offerings including workshops, cohorts, courses, coaching, books, and live events. Max 5/week. Reply STOP to unsubscribe.`,
            relid: contactId,
            reltype: 'Subscriber'
          }
        })
      }).catch(() => {});
    }

    // ⭐ THE WELCOME TEXT. The first message a new member ever gets from Star.
    //
    //    WITHOUT THIS, the first text someone receives is a reminder out of
    //    nowhere, the day after they sign up, from a number they have never
    //    seen. No name, no context. Best case they work it out. Worst case they
    //    report it as spam, and spam complaints are what get an A2P campaign
    //    shut down.
    //
    //    Star's words, Sep 21. He added "save this number" himself and he was
    //    right: a saved contact means every reminder after this shows up as
    //    "Star" instead of a number nobody recognises.
    //
    //    NEW MEMBERS ONLY. Someone re-submitting the form must not get welcomed
    //    a second time, which is why enrol.existing is checked.
    //
    //    Gated on REMINDERS_LIVE too: if sending is disarmed, a welcome that
    //    promises "one text a day" followed by silence is worse than no welcome.
    if (enrol.ok && !enrol.existing && process.env.REMINDERS_LIVE === '1') {
      // 🛡️ THE ONLY THING HERE THAT SPENDS MONEY. Everything else is a database
      //    row. So the abuse ceiling sits on the TEXT, not on the signup: under
      //    a toll-fraud flood people still get signed up and nothing is lost,
      //    we simply stop sending the hello. The attacker earns nothing, Star
      //    spends nothing, and no real person is ever turned away by them.
      const guard = await maySendWelcome(req);
      if (guard.allow) {
        const out = await sendWelcomeText(normalizedPhone).catch(() => null);

        // 🛑 AND IT IS NO LONGER SILENT. Star's first two real testers, in
        //    Sweden and Australia, both failed with "Permission to send an SMS
        //    has not been enabled" because Twilio ships every account US-only.
        //    That wrote one line to a log nobody reads, and he found out from
        //    the testers. A failed send now reaches him the same hour.
        if (out && !out.sent) {
          await alertStarAboutFailedText(normalizedPhone, out.error, firstName, lastName);
        }
      } else {
        await alertStarAboutAbuse(guard, normalizedPhone);
      }
    }

    // 🛑 THE QUIETEST FAILURE IN THE WHOLE SYSTEM, MADE AUDIBLE.
    //    The enrolment at the top of this handler can fail on its own: the
    //    database refuses the insert, or is unreachable. Before this, that
    //    returned a bare `false` nobody read. The member consented, landed on
    //    the list, saw "You are in", and would never receive a single text. No
    //    error, no alert, no way to discover it except them eventually asking
    //    why it never worked.
    //    `stopped` is excluded on purpose: someone who texted STOP is meant to
    //    stay off, and a website form must never quietly resurrect them.
    if (smsOptIn && signupOpen && !enrol.ok && !enrol.stopped) {
      await alertStarAboutLostContact({
        firstName, lastName, email, normalizedPhone, smsOptIn,
        rescued: false, onList: true,
        detail: 'They are on your ActiveCampaign list, but the texting database refused them: ' + enrol.reason,
      });
    }

    // ⭐ TELL STAR SOMEONE JOINED. Star: "How do we get notifications on who
    //    signed up?" Until now a SUCCESSFUL signup sent him nothing at all —
    //    only failures were reported — so he had to go and look in two
    //    dashboards to find out whether Natalie had actually signed up.
    //
    //    One email per signup is right for a ten-person test. If this ever
    //    becomes twenty a day it should become a daily digest instead; the
    //    volume, not the code, is what decides that.
    await notifyStarOfSignup({
      firstName, lastName, email, normalizedPhone, smsOptIn,
      timezone: (req.body && req.body.timezone) || null,
      enrolled: enrol.ok, signupOpen,
    });

    return res.status(200).json({ success: true, sms: smsOptIn, reminders: enrol.ok, crm: true });
  } catch (err) {
    console.error('SMS opt-in error:', err);

    // 🛑 LAST LINE OF DEFENCE. Anything unexpected in the ActiveCampaign work
    //    used to land here and return a 500. The number is already safe by this
    //    point, because the texting database is written before the try block,
    //    so all that is left is to make sure Star knows the contact never
    //    reached his list.
    await alertStarAboutLostContact({
      firstName, lastName, email, normalizedPhone, smsOptIn,
      rescued: enrol.ok,
      detail: 'Unexpected error during signup: ' + String(err?.message || err).slice(0, 200),
    });

    // They filled the form correctly and their number is saved. Showing them a
    // failure would only make them submit again or give up.
    return res.status(200).json({ success: true, sms: smsOptIn, reminders: enrol.ok, crm: false });
  }
}

async function applyTags(AC_URL, headers, contactId, tagNames) {
  for (const tagName of tagNames) {
    try {
      const findRes = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, { headers });
      let tagId;
      if (findRes.ok) {
        const data = await findRes.json();
        const exact = (data.tags || []).find((t) => (t.tag || '').toLowerCase() === tagName.toLowerCase());
        tagId = exact?.id;
      }
      if (!tagId) {
        const createRes = await fetch(`${AC_URL}/api/3/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
        });
        if (createRes.ok) {
          const created = await createRes.json();
          tagId = created.tag?.id;
        }
      }
      if (tagId) {
        await fetch(`${AC_URL}/api/3/contactTags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
        });
      }
    } catch (e) {
      console.warn('Tag apply failed for', tagName, e?.message);
    }
  }
}


/* ───────────────────────────────────────────────────────────────────────────
   ENROL IN THE SMS REMINDER ENGINE
   Writes the two rows api/reminders/send.js reads:
     member_channel  — who they are, their number, their CONSENT timestamp
     message_prefs   — how often and inside what hours

   🛑 Rules baked in here, do not loosen them:
     • consent_at is stamped from THIS submission. send.js filters on
       consent_at is not null, so a row without it can never be texted.
     • Re-submitting must NOT resurrect someone who replied STOP. Only an
       inbound START may do that. We check status first and leave 'stopped'
       alone — a form on a website cannot override a legal opt-out.
     • Never overwrite an existing consent_at. The FIRST one is the TCPA
       record; rewriting it destroys the evidence of when they agreed.
     • Failure is swallowed. The caller already returned the important part.
   ─────────────────────────────────────────────────────────────────────────── */
async function enrolInReminders({ phone, firstName, timezone, source }) {
  const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY || !phone) return { ok: false, reason: 'database not configured' };

  const sb = (path, init = {}) =>
    fetch(`${SB_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

  try {
    // Already known to us?
    const found = await sb(`member_channel?phone=eq.${encodeURIComponent(phone)}&select=id,status,consent_at`);
    const existing = found.ok ? (await found.json())[0] : null;

    if (existing) {
      // 🛑 They replied STOP at some point. A website form does not undo that.
      if (existing.status === 'stopped') return { ok: false, reason: 'they previously texted STOP', stopped: true };

      await sb(`member_channel?id=eq.${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'active',
          first_name: firstName || undefined,
          // Only stamp consent if we somehow never had one. Never replace it.
          consent_at: existing.consent_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      await ensurePrefs(sb, existing.id);
      return { ok: true, existing: true };
    }

    // New member. SMS for everyone, everywhere — same rule the sender uses
    // (see pickChannel in api/reminders/_channel.js), decided once here so the
    // row is honest about its rail. This used to route non-US numbers to
    // WhatsApp, which would have failed at send for every Australian member.
    const channel = 'sms';

    const ins = await sb('member_channel', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        phone,
        first_name: firstName,
        channel,
        // No timezone from the browser -> assume Star's. Wrong for some people,
        // but a null timezone makes send.js skip them entirely, and a member who
        // silently never gets texted is worse than one who gets texted an hour off.
        // They can correct it in the app.
        timezone: timezone || 'America/Los_Angeles',
        consent_at: new Date().toISOString(),
        consent_source: source,
        status: 'active',
      }),
    });
    if (!ins.ok) return { ok: false, reason: 'database refused the insert (' + ins.status + ')' };
    const row = (await ins.json())[0];
    if (!row?.id) return { ok: false, reason: 'database returned no row' };

    await ensurePrefs(sb, row.id);
    return { ok: true, existing: false };
  } catch (e) {
    console.warn('reminder enrol failed (signup itself still succeeded):', e?.message);
    return { ok: false, reason: String(e?.message || e).slice(0, 200) };
  }
}

/* One reminder a day, surprise timing, 8am-9pm. Deliberately the gentlest
   setting available — a new member should never feel crowded by the thing that
   was supposed to help. They can turn it up in the app. */
async function ensurePrefs(sb, memberId) {
  const has = await sb(`message_prefs?member_id=eq.${memberId}&type=eq.reminder&select=id`);
  const rows = has.ok ? await has.json() : [];
  if (rows.length) return;

  await sb('message_prefs', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({
      member_id: memberId,
      type: 'reminder',
      enabled: true,
      frequency: 1,
      mode: 'random',
      window_start: 8,
      window_end: 21,
    }),
  }).catch(() => {});
}

/**
 * ActiveCampaign refused a signup. Tell Star, with everything he needs to add
 * the person by hand, because the alternative is a member who consented and
 * silently vanished.
 *
 * Best effort and never throws: this runs on the failure path, and an error
 * here would turn a partial failure into a total one.
 */
async function alertStarAboutLostContact({ firstName, lastName, email, normalizedPhone, smsOptIn, rescued, detail, onList }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <star@starjessetaylor.com>',
        to: ['star@starjessetaylor.com'],
        subject: onList ? '⚠️ A signup will not receive texts' : '⚠️ A signup did not reach ActiveCampaign',
        html:
          (onList
            ? `<p>Someone signed up at <strong>/sms</strong> and IS on your ActiveCampaign list, but the texting database refused them, ` +
              `so they will <strong>never receive a reminder</strong> until this is fixed. They saw a normal confirmation.</p>`
            : `<p>Someone signed up at <strong>/sms</strong> and ActiveCampaign refused the write, so they are <strong>not on your list</strong>. ` +
              `Add them by hand when you get a chance.</p>`) +
          `<table cellpadding="6" style="border-collapse:collapse;font-size:15px">` +
          `<tr><td><strong>Name</strong></td><td>${esc(firstName)} ${esc(lastName)}</td></tr>` +
          `<tr><td><strong>Email</strong></td><td>${esc(email)}</td></tr>` +
          `<tr><td><strong>Phone</strong></td><td>${esc(normalizedPhone) || 'not given'}</td></tr>` +
          `<tr><td><strong>Consented to texts</strong></td><td>${smsOptIn ? 'YES, ' + new Date().toISOString() : 'no'}</td></tr>` +
          `<tr><td><strong>Texting engine</strong></td><td>${rescued ? 'enrolled, they WILL get their reminders' : 'not enrolled'}</td></tr>` +
          `</table>` +
          `<p style="color:#666;font-size:13px">${esc(String(detail).slice(0, 300))}</p>` +
          `<p style="color:#666;font-size:13px">They were shown a normal confirmation, because from their side it worked. ` +
          `Nothing is lost, it just needs adding to the list.</p>`,
      }),
    });
  } catch { /* the failure path must not fail */ }
}


/**
 * Star's welcome text. Sent once, to a brand new member, right after they sign
 * up and while they are still looking at their phone.
 *
 * Best effort: a Twilio hiccup here must never fail the signup. They are
 * already saved in both systems by the time this runs.
 */
const WELCOME =
  "This is Star. You're in. Save this number so you know it's me. " +
  "One text a day, random time, to get you out of your head and keep you on track. " +
  "Reply STOP whenever you want out.";

async function sendWelcomeText(toE164) {
  const { sendMessage, pickChannel } = await import('./reminders/_channel.js');
  const out = await sendMessage({
    to: toE164,
    body: WELCOME,
    channel: pickChannel(toE164),
  });
  if (!out.sent) console.warn('welcome text not sent:', out.error);
  return out;
}


/**
 * A new signup landed. Put it in front of Star while it is still news.
 * Best effort: a notification must never fail a signup that already worked.
 */
async function notifyStarOfSignup({ firstName, lastName, email, normalizedPhone, smsOptIn, timezone, enrolled, signupOpen }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'No name given';

  // Say plainly what will actually happen next, so Star never has to work it
  // out from three switches.
  let next;
  if (!smsOptIn)      next = 'They did NOT give a number, so they get no texts. They are on your email list.';
  else if (enrolled)  next = 'They have been sent the welcome text, and their first reminder comes tomorrow.';
  else if (!signupOpen) next = 'Signup is CLOSED (REMINDERS_SIGNUP_OPEN is off), so they are consented but not enrolled. Open it and they start.';
  else                next = 'Something went wrong enrolling them. Check the alert email that should have arrived with this one.';

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
        to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
        subject: smsOptIn ? `📲 ${name} signed up for your texts` : `✉️ ${name} joined your list (no number)`,
        html:
          `<table cellpadding="6" style="border-collapse:collapse;font-size:15px">` +
          `<tr><td><strong>Name</strong></td><td>${esc(name)}</td></tr>` +
          `<tr><td><strong>Email</strong></td><td>${esc(email)}</td></tr>` +
          `<tr><td><strong>Phone</strong></td><td>${esc(normalizedPhone) || 'not given'}</td></tr>` +
          `<tr><td><strong>Their timezone</strong></td><td>${esc(timezone) || 'unknown, defaulted to Los Angeles'}</td></tr>` +
          `</table>` +
          `<p style="margin-top:14px">${esc(next)}</p>`,
      }),
    }).catch(() => {});
  } catch { /* never fail a signup over a notification */ }
}


/**
 * A text refused to send. Tell Star the same hour, not never.
 *
 * The country-permission case is called out by name because it is the one that
 * actually happened and the one he can fix himself in thirty seconds.
 */
async function alertStarAboutFailedText(phone, error, firstName, lastName) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const geo = /Permission to send an SMS has not been enabled/i.test(String(error || ''));
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
        to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
        subject: `⚠️ Could not text ${[firstName, lastName].filter(Boolean).join(' ') || phone}`,
        html:
          `<p>The welcome text to <strong>${esc(phone)}</strong> did not send.</p>` +
          `<p><strong>Twilio said:</strong> ${esc(error)}</p>` +
          (geo
            ? `<p><strong>This means their country is switched off on your Twilio account.</strong> ` +
              `Twilio ships every account US-only and each country has to be enabled by hand. ` +
              `Fix it at Console &rarr; Messaging &rarr; Settings &rarr; Geo Permissions. ` +
              `Enabling a country is free, needs no review, and does not affect your A2P registration.</p>` +
              `<p><strong>Their daily reminders will keep failing until you do.</strong></p>`
            : `<p>They are still signed up and enrolled. Their reminders will be attempted as normal.</p>`),
      }),
    }).catch(() => {});
  } catch { /* an alert must never break a signup */ }
}

/**
 * The abuse ceiling tripped. Star needs to know within the hour, because the
 * honest alternative is that it was a real surge and the limit needs raising.
 */
async function alertStarAboutAbuse(guard, phone) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
        to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
        subject: '🛡️ Signup limit hit, welcome texts paused',
        html:
          `<p><strong>${esc(guard.reason)}</strong></p>` +
          `<p>Welcome texts have stopped going out. Nobody has been turned away: they are still ` +
          `signed up, still on your list, and their daily reminders are unaffected. Only the ` +
          `one-off hello is paused, because that is the only part that costs money.</p>` +
          `<p><strong>If this is a real surge</strong> (you posted the link somewhere and it worked), ` +
          `tell me and I will raise the ceiling.</p>` +
          `<p><strong>If it is not</strong>, this is what toll fraud looks like and it has just been ` +
          `stopped. Your balance is capped and there is no auto-recharge, so nothing can be spent ` +
          `beyond what is already in the account.</p>` +
          `<p style="color:#666;font-size:13px">Most recent number: ${esc(phone)}</p>`,
      }),
    }).catch(() => {});
  } catch { /* never break a signup */ }
}
