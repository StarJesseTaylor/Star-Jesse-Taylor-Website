/**
 * Quiz submission handler.
 *
 * Receives quiz answers + email + name, stores the contact in ActiveCampaign,
 * applies tags by quiz path and pain segment, and saves a note containing
 * the full quiz response for later segmentation.
 *
 * Tag names used (Star creates these in AC, no IDs needed in code):
 *   path:book, path:courses, path:intensive, path:cohort, path:coaching
 *   symptom:anxiety_ocd, symptom:stuck, symptom:self_worth, symptom:new
 *   pain:high (8-10), pain:medium (5-7), pain:low (1-4)
 */

const LIST_ID = '4'; // Quiz Funnel List

const SYMPTOM_TAGS = {
  anxiety_ocd: 'symptom:anxiety_ocd',
  stuck: 'symptom:stuck',
  self_worth: 'symptom:self_worth',
  new: 'symptom:new'
};

const PATH_TAGS = {
  book: 'path:book',
  courses: 'path:courses',
  intensive: 'path:intensive',
  cohort: 'path:cohort',
  coaching: 'path:coaching'
};

function painBucket(score) {
  const n = parseInt(score, 10);
  if (isNaN(n)) return 'pain:unknown';
  if (n >= 8) return 'pain:high';
  if (n >= 5) return 'pain:medium';
  return 'pain:low';
}

async function applyTag(AC_URL, headers, contactId, tagName) {
  // Find or create tag by name, then attach to contact
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET',
      headers
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find(t => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
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
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name,
    email,
    phone,
    result,        // 'book' | 'courses' | 'intensive' | 'cohort' | 'coaching'
    symptom,       // 'anxiety_ocd' | 'stuck' | 'self_worth' | 'new'
    painScore,     // 1-10
    stakes,        // free-text: what changes if they solve this
    answers        // raw answers object for the note { q1, q2, q3, q4 }
  } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always log so we have a record even if AC is unreachable
  console.log('Quiz submission:', { name, email, result, symptom, painScore, stakes });

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');

  if (!AC_KEY) {
    // No AC configured yet, still acknowledge so the UX completes
    return res.status(200).json({ success: true, note: 'AC not configured, captured to logs only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Sync contact (creates or updates)
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: {
          email,
          firstName: name || '',
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
    const contactId = contact && contact.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

    // 2. Subscribe to Master Contact List
    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    }).catch(err => console.error('List add error:', err));

    // 3. Apply tags (path, symptom, pain bucket)
    const tagsToApply = [];
    if (result && PATH_TAGS[result]) tagsToApply.push(PATH_TAGS[result]);
    if (symptom && SYMPTOM_TAGS[symptom]) tagsToApply.push(SYMPTOM_TAGS[symptom]);
    if (painScore) tagsToApply.push(painBucket(painScore));
    tagsToApply.push('source:quiz');

    await Promise.all(tagsToApply.map(tag => applyTag(AC_URL, headers, contactId, tag)));

    // 4. Save full quiz data as a note for personalization later
    const noteLines = [
      'Quiz submission ' + new Date().toISOString(),
      'Result path: ' + (result || 'unknown'),
      'Primary symptom: ' + (symptom || 'unknown'),
      'Pain score (1-10): ' + (painScore != null ? painScore : 'not provided'),
      'Stakes (what changes if they solve this in 90 days):',
      stakes || '(skipped)',
      '',
      'Raw answers: ' + JSON.stringify(answers || {})
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
    }).catch(err => console.error('Note error:', err));

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Quiz submit error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
