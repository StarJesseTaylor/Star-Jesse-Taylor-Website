// One phone parser for the whole system. The signup door and the sender MUST
// agree, or we save numbers we can never text. See the note at normalizedPhone.
import { normalisePhone } from './reminders/_channel.js';

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

  const { firstName, email, phone, consent, website_url, source } = req.body || {};

  // Honeypot
  if (website_url) {
    console.log('Bot blocked (honeypot):', { email });
    return res.status(200).json({ success: true });
  }

  // Email is the service on this page. Phone + consent are an OPTIONAL add-on.
  // A submission with no phone must succeed — that is the non-SMS path a carrier
  // reviewer needs to be able to complete. (A2P 10DLC error 30923.)
  if (!email) return res.status(400).json({ error: 'Email is required' });

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
      return res.status(400).json({
        error: 'phone',
        message: "That number doesn't look right. Please include your country code, like +61 for Australia or +65 for Singapore.",
        detail: parsed.reason,
      });
    }
    normalizedPhone = parsed.e164;
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // Sync contact with phone field
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: Object.assign(
          { email, firstName: firstName || '' },
          normalizedPhone ? { phone: normalizedPhone } : {}
        )
      })
    });

    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync error:', syncRes.status, text);
      return res.status(500).json({ error: 'Failed to create contact' });
    }

    const { contact } = await syncRes.json();
    const contactId = contact?.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

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

    // ── THE DOOR INTO THE TEXTING ENGINE. ──
    // Before this existed, a member could tick the box, hand over their number,
    // and land in ActiveCampaign having received exactly zero texts. AC is the
    // email list; the reminder cron reads member_channel. Nothing joined them.
    //
    // Deliberately LAST and deliberately non-fatal: if Supabase is down, the
    // person still gets their email signup and their consent is still recorded
    // in AC. A texting outage must not turn into a failed form.
    //
    // 🔴 CLOSED BY DEFAULT. REMINDERS_SIGNUP_OPEN=1 in the Vercel dashboard is
    //    what opens it. Star's call, Aug 21 2026: the texting side is not ready
    //    for real people yet (no welcome message, webhook not pointed), and a
    //    member who ticks the box today, hears nothing for three weeks, then
    //    suddenly starts getting texts from a number they don't recognise is
    //    the exact bad first impression this whole engine exists to avoid.
    //
    //    NOBODY IS LOST WHILE THIS IS CLOSED. The tick is still honoured: the
    //    contact is still tagged sms:consented in ActiveCampaign and the TCPA
    //    consent note is still written above. So when Star opens the door, the
    //    people who already said yes can be enrolled deliberately, together,
    //    with a welcome message - instead of trickling in half-onboarded.
    //
    //    Kept separate from REMINDERS_LIVE on purpose. Two different questions:
    //      REMINDERS_SIGNUP_OPEN  - may new people join?
    //      REMINDERS_LIVE         - does the schedule actually send?
    //    Star will want signup open and sending armed at different moments (the
    //    Katie/Ghazaal test is exactly that: sending on, signup still shut).
    const signupOpen = process.env.REMINDERS_SIGNUP_OPEN === '1';

    let enrolled = false;
    if (smsOptIn && signupOpen) {
      enrolled = await enrolInReminders({
        phone: normalizedPhone,
        firstName: firstName || null,
        timezone: (req.body && req.body.timezone) || null,
        source: source || 'website',
      });
    }

    return res.status(200).json({ success: true, sms: smsOptIn, reminders: enrolled });
  } catch (err) {
    console.error('SMS opt-in error:', err);
    return res.status(500).json({ error: 'Sign up failed' });
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
  if (!SB_URL || !SB_KEY || !phone) return false;

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
      if (existing.status === 'stopped') return false;

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
      return true;
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
    if (!ins.ok) return false;
    const row = (await ins.json())[0];
    if (!row?.id) return false;

    await ensurePrefs(sb, row.id);
    return true;
  } catch (e) {
    console.warn('reminder enrol failed (signup itself still succeeded):', e?.message);
    return false;
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
