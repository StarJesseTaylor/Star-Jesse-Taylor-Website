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
    message
  } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!firstName) return res.status(400).json({ error: 'First name is required' });

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

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Speaking inquiry error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
