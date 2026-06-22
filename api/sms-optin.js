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

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!phone) return res.status(400).json({ error: 'Phone is required' });
  if (!consent) return res.status(400).json({ error: 'Consent is required' });

  // Bot pattern detector
  if (firstName && /^[A-Za-z]{15,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { email, firstName });
    return res.status(200).json({ success: true });
  }

  // Normalize phone (strip non-digits, store with leading + if missing)
  const phoneDigits = String(phone).replace(/[^\d+]/g, '');
  const normalizedPhone = phoneDigits.startsWith('+') ? phoneDigits : (phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`);

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // Sync contact with phone field
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: {
          email,
          firstName: firstName || '',
          phone: normalizedPhone
        }
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

    // Apply SMS consent tag
    const tags = ['sms:consented', `source:${source || 'website'}`];
    await applyTags(AC_URL, headers, contactId, tags);

    // Log consent for legal record (TCPA compliance)
    await fetch(`${AC_URL}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: `SMS consent recorded ${new Date().toISOString()}. Source: ${source || 'website'}. Phone: ${normalizedPhone}. Disclosure: practice reminders, tips, updates about Star's offerings including workshops, cohorts, courses, coaching, books, and live events. Max 5/week. Reply STOP to unsubscribe.`,
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(() => {});

    return res.status(200).json({ success: true });
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
