/**
 * Cohort Waitlist handler.
 *
 * Captures someone interested in the 10-Week Emotional Fitness Cohort.
 * Adds them to ActiveCampaign, applies cohort waitlist tags, sends a
 * confirmation email via Resend, and notifies Star of the new signup.
 */

const DEFAULT_LIST_ID = '4'; // Falls back to Quiz Funnel List if no dedicated waitlist list set
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
    'You are on the waitlist for the 10-Week Emotional Fitness Cohort.',
    '',
    'Here is what happens next.',
    '',
    'I open the cohort to a small group a few times a year. When the next round opens, you get the email before the public does. That gives you the first shot at one of the seats.',
    '',
    'The cohort is 10 weeks of group coaching with me, plus one private 1-on-1 session. The framework, the practice, the accountability, and a community of people doing the real work alongside you. Standard price is $2,200 paid in full or 3 payments of $797. Waitlist members get first access at the announced price.',
    '',
    'If you want to start moving before the next cohort opens, the fastest path is the book or a Clarity Session.',
    '',
    'Book: ' + SITE_URL + '#book',
    'Clarity Session ($500, fully credits toward any package): ' + SITE_URL + '/services.html',
    '',
    'I will be in touch the moment doors open.',
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
        subject: name ? `${name}, you are on the cohort waitlist` : 'You are on the cohort waitlist',
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
    'New cohort waitlist signup.',
    '',
    'Name: ' + (name || 'not provided'),
    'Email: ' + email,
    'Time: ' + new Date().toISOString(),
    '',
    'They have been added to ActiveCampaign with tags path:cohort, cohort:waitlist, source:website.',
    'Confirmation email already sent to them from hello@starjessetaylor.com.'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cohort Waitlist <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: 'New cohort waitlist signup: ' + (name || email),
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

  const { name, email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log('Cohort waitlist signup:', { name, email });

  // Fire confirmation + Star notification in parallel, don't block on them
  sendConfirmation(email, name).catch(err => console.error('Confirmation error:', err));
  notifyStar(name, email).catch(err => console.error('Notify Star error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_COHORT_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs and emails only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST', headers,
      body: JSON.stringify({ contact: { email, firstName: name || '' } })
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
      applyTag(AC_URL, headers, contactId, 'path:cohort'),
      applyTag(AC_URL, headers, contactId, 'cohort:waitlist'),
      applyTag(AC_URL, headers, contactId, 'source:website')
    ]);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Cohort waitlist error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
