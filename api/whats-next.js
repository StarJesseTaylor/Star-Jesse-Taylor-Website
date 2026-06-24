/**
 * /whats-next interest capture handler.
 *
 * Captures interest in the online workshop and/or cohort from a single form.
 * Tags appropriately in ActiveCampaign so Star can email each segment when
 * dates lock and pre-sales open. Sends a confirmation email via Resend.
 *
 * Used as the IG story swipe-up destination for the workshop + cohort tease.
 */

const DEFAULT_LIST_ID = '3'; // Master Contact List

async function applyTag(AC_URL, headers, contactId, tagName) {
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET',
      headers,
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find((t) => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } }),
      });
      if (create.ok) {
        const data = await create.json();
        tagId = data.tag && data.tag.id;
      }
    }
    if (!tagId) return;
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

async function sendConfirmation(toEmail, name, interestedInWorkshop, interestedInCohort, interestedInCommunity) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const greeting = name ? `Hey ${name},` : 'Hey,';

  let middle = '';
  if (interestedInCommunity) {
    middle = "You're on the list for the community. I'll send the details when it opens.";
  } else if (interestedInWorkshop && interestedInCohort) {
    middle = "You're on the list for both the online workshop and the 6-week cohort. When dates and prices lock, you'll be first to know.";
  } else if (interestedInWorkshop) {
    middle = "You're on the list for the online workshop. When the date and price lock, you'll be first to know.";
  } else if (interestedInCohort) {
    middle = "You're on the list for the next 6-week cohort. When applications open, you'll be first to know.";
  } else {
    middle = "You're on the list. I'll be in touch when there's news.";
  }

  const text = [
    greeting,
    '',
    middle,
    '',
    "Until then, find me on Instagram at @starjessetaylor or TikTok at @starjessetaylor.",
    '',
    'Star',
  ].join('\n');

  const htmlParas = text.split('\n\n').map(p => {
    const safeP = p.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
  }).join('');
  const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParas}</div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [toEmail],
        reply_to: 'star@starjessetaylor.com',
        subject: name ? `${name}, you're on the list` : "You're on the list",
        html,
        text,
      }),
    });
  } catch (err) {
    console.error('Confirmation send failed:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const f = req.body || {};
  if (f.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  if (f.website_url) {
    console.log('Bot blocked (honeypot):', { email: f.email });
    return res.status(200).json({ success: true });
  }

  const email = (f.email || '').trim();
  const firstName = (f.firstName || '').trim();
  const lastName = (f.lastName || '').trim();
  const interestedInWorkshop = !!f.interest_workshop;
  const interestedInCohort = !!f.interest_cohort;
  const interestedInCommunity = !!f.interest_community;

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!firstName || firstName.length < 1) return res.status(400).json({ error: 'First name is required' });
  if (!interestedInWorkshop && !interestedInCohort && !interestedInCommunity) {
    return res.status(400).json({ error: 'Interest required' });
  }

  if (/^[A-Za-z]{15,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');

  if (!AC_KEY) {
    console.error('ACTIVECAMPAIGN_API_KEY missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const contactPayload = { email, firstName };
    if (lastName) contactPayload.lastName = lastName;
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contact: contactPayload }),
    });
    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync error:', syncRes.status, text);
      return res.status(500).json({ error: 'Sign up failed' });
    }

    const { contact } = await syncRes.json();
    const contactId = contact && contact.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactList: { list: DEFAULT_LIST_ID, contact: contactId, status: 1 } }),
    }).catch(() => {});

    const tagPromises = [
      applyTag(AC_URL, headers, contactId, 'source:whats-next'),
    ];
    if (interestedInWorkshop) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'interest:online-workshop'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'path:online-event'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'event:waitlist'));
    }
    if (interestedInCohort) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'interest:cohort'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'path:cohort'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'cohort:waitlist'));
    }
    if (interestedInCommunity) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'interest:skool-community'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'path:skool-public'));
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'skool:waitlist'));
    }
    if (interestedInWorkshop && interestedInCohort) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'interest:both'));
    }
    await Promise.all(tagPromises);

    sendConfirmation(email, firstName, interestedInWorkshop, interestedInCohort, interestedInCommunity).catch((err) =>
      console.error('Confirmation send failed:', err)
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('whats-next handler error:', err);
    return res.status(500).json({ error: 'Sign up failed' });
  }
}
