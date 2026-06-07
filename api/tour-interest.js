/**
 * Workshop Tour Interest handler.
 *
 * Captures someone interested in one or more upcoming workshop cities
 * (LA, NY, Miami, Austin, online, or write-in). Adds to ActiveCampaign,
 * applies per-city tags + shared waitlist tags, notifies Star.
 *
 * Online interest uses the existing path:online-event tag so it folds
 * into the existing online workshop waitlist.
 */

const DEFAULT_LIST_ID = '5';

const CITY_TAGS = {
  la: 'path:tour-la',
  ny: 'path:tour-ny',
  miami: 'path:tour-miami',
  austin: 'path:tour-austin',
  online: 'path:online-event', // existing online workshop waitlist tag
  other: 'path:tour-other',
};

const CITY_LABELS = {
  la: 'Los Angeles',
  ny: 'New York',
  miami: 'Miami',
  austin: 'Austin',
  online: 'Online workshop',
  other: 'Other',
};

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

async function notifyStar(firstName, email, cities, otherCity) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const cityList = cities
    .map(c => c === 'other' && otherCity ? `Other: ${otherCity}` : CITY_LABELS[c] || c)
    .join(', ');
  const text = [
    'New workshop tour interest signup.',
    '',
    'Name: ' + (firstName || 'not provided'),
    'Email: ' + email,
    'Cities of interest: ' + cityList,
    'Time: ' + new Date().toISOString(),
    '',
    'Tags applied: ' + cities.map(c => CITY_TAGS[c]).filter(Boolean).join(', '),
    'Also tagged: event:waitlist, path:tour-interest, source:website'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: ['jessetaylortraxxx@gmail.com'],
        reply_to: 'starjessetaylor@gmail.com',
        subject: `Tour interest: ${firstName || 'Someone'} → ${cityList}`,
        text
      })
    });
  } catch (err) { console.error('Notify Star failed:', err); }
}

async function sendConfirmation(toEmail, firstName, cities, otherCity) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const cityList = cities
    .map(c => c === 'other' && otherCity ? otherCity : CITY_LABELS[c] || c)
    .join(', ');
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const text = [
    greeting,
    '',
    'You are on the list for the workshop tour.',
    '',
    'You said you want me in: ' + cityList + '.',
    '',
    'Here is what happens next.',
    '',
    'When the date and venue lock in for your city, you get the email before the public does. You also get first pick of seats and the best price.',
    '',
    'If your city wasn\'t on the list and you wrote it in, I see it. The cities with the most demand are the ones I book first.',
    '',
    'Have the audacity to live your life.',
    '',
    'Star'
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
        reply_to: 'starjessetaylor@gmail.com',
        subject: firstName ? `${firstName}, you are on the tour list` : 'You are on the tour list',
        html, text
      })
    });
  } catch (err) { console.error('Confirmation send failed:', err); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const firstName = String(body.firstName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const cities = Array.isArray(body.cities) ? body.cities.filter(c => CITY_TAGS[c]) : [];
  const otherCity = String(body.otherCity || '').trim();

  if (!email || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!firstName || firstName.length < 1) return res.status(400).json({ error: 'First name is required' });
  if (cities.length === 0) return res.status(400).json({ error: 'Pick at least one city or the online workshop' });
  if (cities.includes('other') && !otherCity) return res.status(400).json({ error: 'You picked Other — tell us which city' });

  // Bot guard — single long uppercase-Lowercase scramble in name
  if (/^[A-Za-z]{12,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  console.log('Tour interest signup:', { firstName, email, cities, otherCity });

  // Fire emails (best-effort, don't block on them)
  notifyStar(firstName, email, cities, otherCity).catch(err => console.error('Notify Star error:', err));
  sendConfirmation(email, firstName, cities, otherCity).catch(err => console.error('Confirmation error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_EVENT_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs and emails only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const contactPayload = { email, firstName };
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
      applyTag(AC_URL, headers, contactId, 'event:waitlist'),
      applyTag(AC_URL, headers, contactId, 'source:website'),
      applyTag(AC_URL, headers, contactId, 'path:tour-interest'),
    ];
    for (const city of cities) {
      const tag = CITY_TAGS[city];
      if (tag) tagPromises.push(applyTag(AC_URL, headers, contactId, tag));
    }
    if (cities.includes('other') && otherCity) {
      tagPromises.push(applyTag(AC_URL, headers, contactId, 'requested_city:' + otherCity));
    }
    await Promise.all(tagPromises);

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Tour interest error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
};
