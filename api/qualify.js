const LIST_ID = '3'; // Master Contact List

const LOCATION_TAGS = {
  'usa-west':    'Location: USA West Coast',
  'usa-east':    'Location: USA East Coast',
  'usa-central': 'Location: USA Central',
  'europe':      'Location: Europe',
  'anz':         'Location: Australia/New Zealand',
  'asia':        'Location: Asia',
  'latam':       'Location: Latin America',
  'other':       'Location: Other'
};

const INTEREST_TAGS = {
  '1on1-coaching':      'Interest: 1-on-1 Coaching',
  'group-cohort':       'Interest: Group/Cohort',
  'courses-self-study': 'Interest: Courses',
  'live-events':        'Interest: Live Events',
  'free-resources':     'Interest: Free Resources'
};

const SOURCE_TAGS = {
  'tiktok':    'Source: TikTok',
  'instagram': 'Source: Instagram',
  'youtube':   'Source: YouTube',
  'google':    'Source: Google',
  'referral':  'Source: Referral'
};

const TIER_TAGS = {
  'hot-lead':  'Tier: Hot Lead',
  'warm-lead': 'Tier: Warm Lead',
  'nurture':   'Tier: Nurture'
};

const SEMINAR_TAGS = {
  'yes-regularly':   'Seminars: Regular',
  'yes-few-times':   'Seminars: Some',
  'no-want-to':      'Seminars: Curious',
  'no-not-my-thing': 'Seminars: No'
};

const CHALLENGE_TAGS = {
  'intrusive-thoughts': 'Challenge: Intrusive Thoughts',
  'rumination':         'Challenge: Rumination',
  'anxiety':            'Challenge: Anxiety',
  'panic-attacks':      'Challenge: Panic Attacks',
  'dpdr':               'Challenge: DPDR',
  'ocd':                'Challenge: OCD',
  'relationship-ocd':   'Challenge: Relationship OCD',
  'adhd':               'Challenge: ADHD',
  'depression':         'Challenge: Depression',
  'self-worth':         'Challenge: Self-Worth',
  'trauma':             'Challenge: Trauma',
  'other':              'Challenge: Other'
};

async function getOrCreateTag(tagName, headers, baseUrl) {
  const search = await fetch(`${baseUrl}/api/3/tags?search=${encodeURIComponent(tagName)}`, { headers });
  if (search.ok) {
    const data = await search.json();
    const exact = (data.tags || []).find(t => t.tag === tagName);
    if (exact) return exact.id;
  }
  const create = await fetch(`${baseUrl}/api/3/tags`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact', description: 'Auto-created from Find Your Path form' } })
  });
  if (!create.ok) return null;
  const created = await create.json();
  return created.tag?.id || null;
}

async function applyTag(contactId, tagId, headers, baseUrl) {
  if (!tagId) return;
  await fetch(`${baseUrl}/api/3/contactTags`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = process.env.ACTIVECAMPAIGN_API_URL;
  if (!AC_KEY || !AC_URL) return res.status(500).json({ error: 'Server configuration error' });

  const baseUrl = AC_URL.replace(/\/$/, '');
  const { firstName, email, answers, score, tier } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Sync contact
    const syncRes = await fetch(`${baseUrl}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contact: { email, firstName: firstName || '' } })
    });
    if (!syncRes.ok) {
      const t = await syncRes.text();
      console.error('AC sync error:', syncRes.status, t);
      return res.status(500).json({ error: 'Failed to sync contact' });
    }
    const { contact } = await syncRes.json();
    const contactId = contact?.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID' });

    // 2. Subscribe to Master Contact List
    await fetch(`${baseUrl}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactList: { list: LIST_ID, contact: contactId, status: 1 } })
    }).catch(() => {});

    // 3. Build tag list from answers
    const a = answers || {};
    const tagsToApply = [];

    if (LOCATION_TAGS[a.q5])           tagsToApply.push(LOCATION_TAGS[a.q5]);
    if (INTEREST_TAGS[a.q1])           tagsToApply.push(INTEREST_TAGS[a.q1]);
    if (SOURCE_TAGS[a.q6])             tagsToApply.push(SOURCE_TAGS[a.q6]);
    if (TIER_TAGS[tier])               tagsToApply.push(TIER_TAGS[tier]);
    if (SEMINAR_TAGS[a.q3])            tagsToApply.push(SEMINAR_TAGS[a.q3]);
    if (CHALLENGE_TAGS[a.q_challenge]) tagsToApply.push(CHALLENGE_TAGS[a.q_challenge]);

    // Book buyer / past client / therapy history
    if (['yes-book','yes-both'].indexOf(a.q4) !== -1)        tagsToApply.push('Book Buyer');
    if (['yes-course','yes-both'].indexOf(a.q4) !== -1)      tagsToApply.push('Course Student');
    if (['yes-coaching','yes-both'].indexOf(a.q2) !== -1)    tagsToApply.push('Past Client');
    if (['yes-therapy','yes-both'].indexOf(a.q2) !== -1)     tagsToApply.push('Has Done Therapy');
    if (a.q2 === 'no-ready')                                  tagsToApply.push('No Prior Therapy: Ready');
    if (a.q2 === 'no-self-guided')                            tagsToApply.push('No Prior Therapy: Self-Guided');

    // 4. Apply all tags (resolve IDs first, in parallel)
    const tagIds = await Promise.all(tagsToApply.map(t => getOrCreateTag(t, headers, baseUrl)));
    await Promise.all(tagIds.map(id => applyTag(contactId, id, headers, baseUrl)));

    // 5. Save score and qualification details as a note
    const challengeLine = a.q_challenge === 'other' && a.q_challenge_text
      ? `Challenge (write-in): "${String(a.q_challenge_text).slice(0, 500)}"`
      : `Challenge: ${a.q_challenge || 'not provided'}`;

    await fetch(`${baseUrl}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: `Find Your Path submission.\nScore: ${score}/10. Tier: ${tier}.\n${challengeLine}\nAnswers: Looking for=${a.q1}, Therapy/coaching=${a.q2}, Seminars=${a.q3}, Book/courses=${a.q4}, Location=${a.q5}, Source=${a.q6}`,
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(() => {});

    return res.status(200).json({ success: true, contactId, tier, score, tagsApplied: tagsToApply });
  } catch (err) {
    console.error('Qualify error:', err);
    return res.status(500).json({ error: 'Qualification failed' });
  }
}
