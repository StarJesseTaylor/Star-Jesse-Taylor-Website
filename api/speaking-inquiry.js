const LIST_ID = '3';
const SPEAKING_TAG = 'Speaking Inquiry';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  if (!AC_KEY) return res.status(500).json({ error: 'Server configuration error' });

  const body = req.body || {};
  const {
    firstName,
    lastName,
    email,
    phone,
    organization,
    role,
    eventName,
    eventDate,
    eventLocation,
    audienceSize,
    audienceType,
    topic,
    budget,
    message,
    website_url
  } = body;

  if (body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  // Honeypot
  if (website_url) {
    console.log('Bot blocked (honeypot):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!firstName) return res.status(400).json({ error: 'First name is required' });

  // Bot pattern detector: long alphabetic string, no spaces, mixed case
  if (firstName && /^[A-Za-z]{15,}$/.test(firstName) && /[A-Z]/.test(firstName) && /[a-z]/.test(firstName)) {
    console.log('Bot blocked (gibberish name):', { firstName, email });
    return res.status(200).json({ success: true });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: {
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          phone: phone || ''
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
    if (!contactId) return res.status(500).json({ error: 'No contact ID' });

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    });

    try {
      const tagSearchRes = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(SPEAKING_TAG)}`, { headers });
      const tagData = await tagSearchRes.json();
      let tagId = tagData.tags?.[0]?.id;

      if (!tagId) {
        const createTagRes = await fetch(`${AC_URL}/api/3/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tag: { tag: SPEAKING_TAG, tagType: 'contact', description: 'Submitted speaking engagement inquiry from website' } })
        });
        const created = await createTagRes.json();
        tagId = created.tag?.id;
      }

      if (tagId) {
        await fetch(`${AC_URL}/api/3/contactTags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
        });
      }
    } catch (tagErr) {
      console.warn('Tag error (non-fatal):', tagErr);
    }

    const noteLines = [
      'SPEAKING INQUIRY',
      '',
      `Organization: ${organization || 'n/a'}`,
      `Role: ${role || 'n/a'}`,
      `Event: ${eventName || 'n/a'}`,
      `Event Date: ${eventDate || 'n/a'}`,
      `Location: ${eventLocation || 'n/a'}`,
      `Audience Size: ${audienceSize || 'n/a'}`,
      `Audience Type: ${audienceType || 'n/a'}`,
      `Topic Interest: ${topic || 'n/a'}`,
      `Budget: ${budget || 'n/a'}`,
      `Phone: ${phone || 'n/a'}`,
      '',
      'Message:',
      message || '(none)'
    ];

    await fetch(`${AC_URL}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: noteLines.join('\n'),
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(() => {});

    // Email Star directly so speaking gigs do not sit silently in AC.
    // Speaking inquiries are high-value (paid gigs) — Star needs to see
    // them in his inbox, not just as an AC tag.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const subject = `New Speaking Inquiry: ${firstName} ${lastName || ''}`.trim() +
        (organization ? ` (${organization})` : '');
      const fullName = `${firstName} ${lastName || ''}`.trim();
      const emailText = [
        '=== NEW SPEAKING INQUIRY ===',
        'Submitted: ' + new Date().toISOString(),
        '',
        '— CONTACT —',
        'Name: ' + fullName,
        'Email: ' + email,
        'Phone: ' + (phone || '(blank)'),
        '',
        '— ORG —',
        'Organization: ' + (organization || '(blank)'),
        'Role: ' + (role || '(blank)'),
        '',
        '— EVENT —',
        'Event: ' + (eventName || '(blank)'),
        'Date: ' + (eventDate || '(blank)'),
        'Location: ' + (eventLocation || '(blank)'),
        'Audience size: ' + (audienceSize || '(blank)'),
        'Audience type: ' + (audienceType || '(blank)'),
        '',
        '— TOPIC AND BUDGET —',
        'Topic interest: ' + (topic || '(blank)'),
        'Budget: ' + (budget || '(blank)'),
        '',
        '— MESSAGE —',
        message || '(blank)',
        '',
        '============================='
      ].join('\n');
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Speaking Inquiries <hello@starjessetaylor.com>',
            to: ['starjessetaylor@gmail.com'],
            reply_to: email,
            subject,
            text: emailText
          })
        });
      } catch (err) {
        console.error('Resend speaking-inquiry email-to-Star failed:', err);
      }
    } else {
      console.warn('RESEND_API_KEY missing — speaking inquiry captured to AC but Star not emailed');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Speaking inquiry error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
