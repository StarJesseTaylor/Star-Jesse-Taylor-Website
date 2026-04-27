const AC_URL = 'https://starjessetaylor92181.api-us1.com';
const LIST_ID = '3';
const FREE_CHAPTER_TAG = 'Free Chapter Download';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  if (!AC_KEY) return res.status(500).json({ error: 'Server configuration error' });

  const { email, firstName, interests } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // Sync contact
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contact: { email, firstName: firstName || '' } })
    });

    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync error:', syncRes.status, text);
      return res.status(500).json({ error: 'Failed to create contact' });
    }

    const { contact } = await syncRes.json();
    const contactId = contact?.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID' });

    // Subscribe to Master Contact List
    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    });

    // Create tag if it doesn't exist, then apply it
    try {
      const tagSearchRes = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(FREE_CHAPTER_TAG)}`, { headers });
      const tagData = await tagSearchRes.json();
      let tagId = tagData.tags?.[0]?.id;

      if (!tagId) {
        const createTagRes = await fetch(`${AC_URL}/api/3/tags`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ tag: { tag: FREE_CHAPTER_TAG, tagType: 'contact', description: 'Downloaded free book chapter from website' } })
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

    // Add interests note if provided
    if (Array.isArray(interests) && interests.length > 0) {
      await fetch(`${AC_URL}/api/3/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          note: {
            note: 'Website interests: ' + interests.join(', '),
            relid: contactId,
            reltype: 'Subscriber'
          }
        })
      }).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Free chapter subscribe error:', err);
    return res.status(500).json({ error: 'Subscription failed' });
  }
}
