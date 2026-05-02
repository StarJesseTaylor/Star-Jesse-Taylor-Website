const LIST_ID = '3';

const BASE_TAGS = ['LA Workshop Buyer', 'LA Buyer Questionnaire Submitted', 'Hot Lead'];

const TIER_TAG_MAP = {
  'ga': 'LA Workshop GA Buyer',
  'vip': 'LA Workshop VIP Buyer'
};

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
    email,
    tier,
    walkAway,
    biggestChallenge,
    feelStuck,
    askStar
  } = req.body || {};

  if (!firstName) return res.status(400).json({ error: 'First name is required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  const tagsToApply = [...BASE_TAGS];
  if (tier && TIER_TAG_MAP[tier]) tagsToApply.push(TIER_TAG_MAP[tier]);

  try {
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

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    });

    for (const tagName of tagsToApply) {
      try {
        const tagSearchRes = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, { headers });
        const tagData = await tagSearchRes.json();
        let tagId = tagData.tags?.find(t => t.tag === tagName)?.id;

        if (!tagId) {
          const createTagRes = await fetch(`${AC_URL}/api/3/tags`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact', description: 'Auto applied via LA Workshop questionnaire' } })
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
        console.warn(`Tag error for "${tagName}" (non-fatal):`, tagErr);
      }
    }

    const noteText = [
      'LA WORKSHOP QUESTIONNAIRE — May 30, 2026',
      tier ? `Tier: ${tier.toUpperCase()}` : '',
      '',
      'What they want to walk away with:',
      walkAway?.trim() || '(no answer)',
      '',
      'Biggest challenge right now:',
      biggestChallenge?.trim() || '(no answer)',
      '',
      'Where they feel most stuck:',
      feelStuck?.trim() || '(no answer)',
      '',
      'If we had 5 minutes alone, they would ask Star:',
      askStar?.trim() || '(no answer)'
    ].filter(Boolean).join('\n');

    await fetch(`${AC_URL}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: noteText,
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Workshop questionnaire error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
