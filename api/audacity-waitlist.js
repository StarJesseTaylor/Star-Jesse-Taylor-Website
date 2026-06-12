/**
 * Audacity App Launch Waitlist handler.
 *
 * People who sign up at /app to be notified when Audacity ships on the
 * App Store. Tagged for first-access + founding pricing reservation.
 * Tags in ActiveCampaign: path:audacity-waitlist, signup-method:waitlist,
 * source:*. Sends a confirmation email in Star's voice. Notifies Star.
 */

const DEFAULT_LIST_ID = '3'; // Master Contact List

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
    "You're on the Audacity waitlist.",
    '',
    'The day Audacity hits the App Store, you get the link before the public does.',
    '',
    "You also get founding pricing reserved for you. Founding members lock in a permanent rate that public users will never see.",
    '',
    "Audacity is the daily practice of Emotional Fitness. The framework I've been teaching for years, in your pocket. Daily check-in, valued action garden, the Spiral Breaker for when something is loud, Star AI as the guide.",
    '',
    "I'll write again when it ships.",
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
        subject: name ? `${name}, you are on the Audacity waitlist` : 'You are on the Audacity waitlist',
        html, text
      })
    });
    if (!res.ok) console.error('Resend confirmation error:', res.status, await res.text());
  } catch (err) { console.error('Confirmation send failed:', err); }
}

async function notifyStar(name, email, sourceTag) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const text = [
    'New Audacity waitlist signup.',
    '',
    'Name: ' + (name || 'not provided'),
    'Email: ' + email,
    'Source: ' + (sourceTag || 'direct'),
    'Time: ' + new Date().toISOString(),
    '',
    'Tags applied: path:audacity-waitlist, signup-method:waitlist' +
      (sourceTag ? ', ' + sourceTag : ''),
    'Confirmation email already sent.'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Audacity Waitlist <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: 'New Audacity waitlist: ' + (name || email),
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
  const { name, lastName, email, source, website_url } = body;

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

  // Normalize source tag
  let sourceTag = 'source:website';
  if (source === 'ig-story' || source === 'instagram') sourceTag = 'source:ig-story';
  else if (source === 'youtube') sourceTag = 'source:youtube';
  else if (source === 'tiktok') sourceTag = 'source:tiktok';
  else if (source === 'podcast') sourceTag = 'source:podcast';
  else if (source === 'email') sourceTag = 'source:email';

  console.log('Audacity waitlist signup:', { name, email, sourceTag });

  sendConfirmation(email, name).catch(err => console.error('Confirmation error:', err));
  notifyStar(name, email, sourceTag).catch(err => console.error('Notify Star error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_AUDACITY_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs and emails only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const contactPayload = { email, firstName: name || '' };
    if (lastName) contactPayload.lastName = lastName;
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

    await Promise.all([
      applyTag(AC_URL, headers, contactId, 'path:audacity-waitlist'),
      applyTag(AC_URL, headers, contactId, 'signup-method:waitlist'),
      applyTag(AC_URL, headers, contactId, sourceTag),
    ]);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Audacity waitlist error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
