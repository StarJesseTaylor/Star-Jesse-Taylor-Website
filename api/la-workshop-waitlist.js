/**
 * LA Workshop Waitlist handler.
 *
 * Captures someone who wants first access to the in-person LA workshop
 * (Saturday, November 14, 2026). Adds to ActiveCampaign, applies workshop
 * tags, sends a confirmation email via Resend, and notifies Star.
 *
 * Mirrors api/la-meetup-waitlist.js. To segment these separately in AC,
 * set AC_LA_WORKSHOP_LIST_ID to a dedicated list id; otherwise it falls
 * back to the shared event waitlist list (5).
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
    'You are on the waitlist for the LA workshop, Saturday, November 14, 2026.',
    '',
    'Here is what happens next.',
    '',
    'This is a full day, in person, in Los Angeles. A room with a wall to wall whiteboard, a small group, and the complete Emotional Fitness work practiced together, not just watched.',
    '',
    'When seats open, the waitlist hears first and gets first access before anyone else. The exact location goes out to the list first too.',
    '',
    'Looking forward to being in the room with you.',
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
        subject: name ? `${name}, you are on the LA workshop waitlist` : 'You are on the LA workshop waitlist',
        html, text
      })
    });
    if (!res.ok) console.error('Resend confirmation error:', res.status, await res.text());
  } catch (err) { console.error('Confirmation send failed:', err); }
}

async function notifyStar(name, email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const text = [
    'New LA workshop waitlist signup.',
    '',
    'Name: ' + (name || 'not provided'),
    'Email: ' + email,
    'Time: ' + new Date().toISOString(),
    '',
    'They have been added to ActiveCampaign with tags workshop:la-nov-14-2026, path:la-workshop, workshop:waitlist, source:website, location:los-angeles.',
    'Confirmation email already sent to them from hello@starjessetaylor.com.'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LA Workshop <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: 'New LA workshop waitlist signup: ' + (name || email),
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
  const { firstName, lastName, email, website_url } = body;

  if (body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  if (website_url) {
    console.log('Bot blocked (honeypot):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!firstName || firstName.trim().length < 2) return res.status(400).json({ error: 'First name is required' });
  if (!lastName || lastName.trim().length < 1) return res.status(400).json({ error: 'Last name is required' });

  if (/^[A-Za-z]{12,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  console.log('LA workshop waitlist signup:', { firstName, email });

  sendConfirmation(email, firstName).catch(err => console.error('Confirmation error:', err));
  notifyStar(firstName, email).catch(err => console.error('Notify Star error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_LA_WORKSHOP_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs and emails only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const contactPayload = { email, firstName: firstName || '' };
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
      applyTag(AC_URL, headers, contactId, 'workshop:la-nov-14-2026'),
      applyTag(AC_URL, headers, contactId, 'path:la-workshop'),
      applyTag(AC_URL, headers, contactId, 'workshop:waitlist'),
      applyTag(AC_URL, headers, contactId, 'source:website'),
      applyTag(AC_URL, headers, contactId, 'location:los-angeles')
    ]);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('LA workshop waitlist error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
