/**
 * Online Event Waitlist handler.
 *
 * Captures someone interested in the next From Anxiety to Confidence
 * online workshop. Adds to ActiveCampaign, applies waitlist tags,
 * sends a confirmation email via Resend, and notifies Star.
 */

const DEFAULT_LIST_ID = '5';
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
    'You are on the waitlist for the next From Anxiety to Confidence online workshop.',
    '',
    'Here is what happens next.',
    '',
    'When the date is locked, you get the email before the public does. You also get the lowest price and first pick of any limited bonus seats.',
    '',
    'The workshop is live on Zoom. The framework, the practice, the hot seat coaching, and a real shift you can feel by the end of the day. Open to anyone, anywhere.',
    '',
    'In the meantime, if you have a question you want answered before the workshop, you can send me a paid voice memo at ask.meanything.co/starjessetaylor.',
    '',
    'See you soon.',
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
        subject: name ? `${name}, you are on the workshop waitlist` : 'You are on the workshop waitlist',
        html, text
      })
    });
    if (!res.ok) console.error('Resend confirmation error:', res.status, await res.text());
  } catch (err) { console.error('Confirmation send failed:', err); }
}

async function notifyStar(name, email, country) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const text = [
    'New online workshop waitlist signup.',
    '',
    'Name: ' + (name || 'not provided'),
    'Email: ' + email,
    'Country: ' + (country || 'not provided'),
    'Time: ' + new Date().toISOString(),
    '',
    'They have been added to ActiveCampaign with tags path:online-event, event:waitlist, source:website.',
    'Confirmation email already sent to them from hello@starjessetaylor.com.'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Event Waitlist <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: 'New online workshop waitlist signup: ' + (name || email),
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
  const { name, lastName, email, country, website_url } = body;

  if (body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  if (website_url) {
    console.log('Bot blocked (honeypot):', { name, email });
    return res.status(200).json({ success: true });
  }

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'First name is required' });
  if (!lastName || lastName.trim().length < 1) return res.status(400).json({ error: 'Last name is required' });
  if (!country || country.trim().length < 2) return res.status(400).json({ error: 'Country is required' });

  if (/^[A-Za-z]{12,}$/.test(name) && /[A-Z]/.test(name) && /[a-z]/.test(name)) {
    console.log('Bot blocked (gibberish name):', { name, email });
    return res.status(200).json({ success: true });
  }

  console.log('Event waitlist signup:', { name, email, country });

  sendConfirmation(email, name).catch(err => console.error('Confirmation error:', err));
  notifyStar(name, email, country).catch(err => console.error('Notify Star error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_EVENT_LIST_ID || DEFAULT_LIST_ID;

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

    const tagPromises = [
      applyTag(AC_URL, headers, contactId, 'path:online-event'),
      applyTag(AC_URL, headers, contactId, 'event:waitlist'),
      applyTag(AC_URL, headers, contactId, 'source:website')
    ];
    if (country && country.trim()) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'country:' + country.trim()));
    }
    await Promise.all(tagPromises);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Event waitlist error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
