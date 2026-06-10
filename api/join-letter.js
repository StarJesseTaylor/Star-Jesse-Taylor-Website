/**
 * Star's Letters signup handler.
 *
 * The honest filter signup. No lead magnet, no PDF, no freebie.
 * Captures: first name, last name, email, optional phone with SMS opt-in.
 * Tags in ActiveCampaign: path:stars-letters, signup-method:resonance,
 * source:* (ig-story, youtube, tiktok, etc), sms:opted-in (if applicable).
 * Sends a confirmation email in Star's voice. Notifies Star.
 */

const DEFAULT_LIST_ID = '3'; // Master Contact List
const SITE_URL = 'https://starjessetaylor.com';

async function applyTag(AC_URL, headers, contactId, tagName) {
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET', headers
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find(t => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST', headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
      });
      if (create.ok) {
        const data = await create.json();
        tagId = data.tag && data.tag.id;
      }
    }
    if (!tagId) return;
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST', headers,
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

async function sendConfirmation(toEmail, name) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const greeting = name ? `Hey ${name},` : 'Hey,';
  const text = [
    greeting,
    '',
    "You are signed up for Star's Letters.",
    '',
    'For daily reminders to stay on track, join my WhatsApp group:',
    'https://chat.whatsapp.com/Iu8X0qemy6R3XkHFBWN9f7?s=cl&p=i&mlu=1&amv=1',
    '',
    'Star'
  ].join('\n');

  const htmlParas = text.split('\n\n').map(p => {
    const safeP = p.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
  }).join('');
  const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParas}</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [toEmail],
        reply_to: 'starjessetaylor@gmail.com',
        subject: name ? `${name}, you are signed up for Star's Letters` : "You are signed up for Star's Letters",
        html, text
      })
    });
    if (!res.ok) console.error('Resend confirmation error:', res.status, await res.text());
  } catch (err) { console.error('Confirmation send failed:', err); }
}

async function notifyStar(name, email, phone, smsOptIn, sourceTag) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const text = [
    "New Star's Letters signup.",
    '',
    'Name: ' + (name || 'not provided'),
    'Email: ' + email,
    'Phone: ' + (phone || 'not provided'),
    'SMS opt-in: ' + (smsOptIn ? 'yes' : 'no'),
    'Source: ' + (sourceTag || 'direct'),
    'Time: ' + new Date().toISOString(),
    '',
    "Tags applied: path:stars-letters, signup-method:resonance" +
      (smsOptIn ? ', sms:opted-in' : '') +
      (sourceTag ? ', ' + sourceTag : ''),
    'Confirmation email already sent.'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: "Star's Letters <hello@starjessetaylor.com>",
        to: ['starjessetaylor@gmail.com'],
        subject: "New Star's Letters signup: " + (name || email),
        text
      })
    });
  } catch (err) { console.error('Star notification failed:', err); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { name, lastName, email, phone, smsOptIn, source, website_url } = body;

  if (body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  if (website_url) {
    console.log('Bot blocked (honeypot):', { name, email });
    return res.status(200).json({ success: true });
  }

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'First name is required' });

  if (/^[A-Za-z]{12,}$/.test(name) && /[A-Z]/.test(name) && /[a-z]/.test(name)) {
    console.log('Bot blocked (gibberish name):', { name, email });
    return res.status(200).json({ success: true });
  }

  // Normalize source tag from query or referrer
  let sourceTag = '';
  if (source === 'ig-story' || source === 'instagram') sourceTag = 'source:ig-story';
  else if (source === 'youtube') sourceTag = 'source:youtube';
  else if (source === 'tiktok') sourceTag = 'source:tiktok';
  else if (source === 'podcast') sourceTag = 'source:podcast';
  else sourceTag = 'source:website';

  // Normalize phone to E.164ish
  let phoneClean = '';
  let phoneIsValid = false;
  if (phone && typeof phone === 'string' && phone.trim()) {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.length === 10) {
      phoneClean = `+1${digits}`;
      phoneIsValid = true;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      phoneClean = `+${digits}`;
      phoneIsValid = true;
    } else if (digits.length >= 8) {
      phoneClean = `+${digits}`;
      phoneIsValid = true;
    }
  }
  const willOptInSms = !!smsOptIn && phoneIsValid;

  console.log('Letter signup:', { name, email, phone: phoneClean, sourceTag });

  sendConfirmation(email, name).catch(err => console.error('Confirmation error:', err));
  notifyStar(name, email, phoneClean, willOptInSms, sourceTag).catch(err => console.error('Notify Star error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_LETTER_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs and emails only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const contactPayload = { email, firstName: name || '' };
    if (lastName) contactPayload.lastName = lastName;
    if (phoneClean) contactPayload.phone = phoneClean;
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST', headers,
      body: JSON.stringify({ contact: contactPayload })
    });
    if (!syncRes.ok) {
      console.error('AC sync error:', syncRes.status, await syncRes.text());
      return res.status(500).json({ error: 'Failed to create contact' });
    }
    const { contact } = await syncRes.json();
    const contactId = contact && contact.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID' });

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST', headers,
      body: JSON.stringify({ contactList: { list: LIST_ID, contact: contactId, status: 1 } })
    }).catch(err => console.error('List add error:', err));

    const tagPromises = [
      applyTag(AC_URL, headers, contactId, 'path:stars-letters'),
      applyTag(AC_URL, headers, contactId, 'signup-method:resonance'),
      applyTag(AC_URL, headers, contactId, sourceTag),
    ];
    if (willOptInSms) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'sms:opted-in'));
    }
    await Promise.all(tagPromises);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Letter signup error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
