/**
 * Admin endpoint: Star's existing-relationship contacts
 *
 * Returns every AC contact who has one of the "established relationship"
 * tags (Book Reader, course buyer, coaching client). Star uses this to
 * cross-reference against quiz applicants who CLAIMED these relationships
 * — anyone in the dashboard tagged tester-history-book who is NOT in
 * this list might have lied to get into the tester pool.
 *
 * Star June 15 2026: "Some of them lied. I should have asked for receipts."
 *
 * Auth: ?key=CRON_SECRET
 */

const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

const RELATIONSHIP_TAGS = {
  book: ['Book Reader'],
  free_chapter: ['Free Chapter Download'],
  courses: ['Self Worth Course', 'Course Buyer', 'Course Customer', 'self-worth-course-buyer'],
  coaching: ['1on1 Client', 'Coaching Client', 'Current Coaching', 'Past Coaching Client', 'coaching-client'],
  cohort: ['Cohort Grad', 'Cohort Alumni', '10 Week Cohort', 'cohort-grad'],
  workshop: ['Workshop Attended', 'Workshop Alumni', 'May 30 LA', 'workshop-attended'],
};

async function findTagIdsForNames(headers, names) {
  const ids = [];
  for (const name of names) {
    try {
      const res = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(name)}&limit=20`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) continue;
      const data = await res.json();
      const match = (data.tags || []).find((t) => t.tag.toLowerCase() === name.toLowerCase());
      if (match) ids.push({ id: match.id, name: match.tag });
    } catch {}
  }
  return ids;
}

async function fetchContactsForTagId(headers, tagId) {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (let safety = 0; safety < 20; safety++) {
    const res = await fetch(`${AC_URL}/api/3/contacts?tagid=${tagId}&limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) break;
    const data = await res.json();
    const batch = data.contacts || [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!AC_KEY) return res.status(500).json({ error: 'AC key missing' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  // Build map: email -> { name, relationships: Set, ac_contact_id }
  const byEmail = new Map();

  for (const [groupKey, tagNames] of Object.entries(RELATIONSHIP_TAGS)) {
    const tagInfos = await findTagIdsForNames(headers, tagNames);
    for (const tagInfo of tagInfos) {
      const contacts = await fetchContactsForTagId(headers, tagInfo.id);
      for (const c of contacts) {
        const email = (c.email || '').toLowerCase();
        if (!email) continue;
        if (!byEmail.has(email)) {
          byEmail.set(email, {
            email: c.email,
            first_name: c.firstName || '',
            last_name: c.lastName || '',
            phone: c.phone || '',
            ac_contact_id: c.id,
            relationships: new Set(),
            tags_seen: new Set(),
          });
        }
        const entry = byEmail.get(email);
        entry.relationships.add(groupKey);
        entry.tags_seen.add(tagInfo.name);
      }
    }
  }

  // Convert to array, prioritize by relationship depth
  const all = Array.from(byEmail.values()).map((e) => ({
    ...e,
    relationships: Array.from(e.relationships),
    tags_seen: Array.from(e.tags_seen),
    depth: e.relationships.size,
  }));

  // Sort: most relationships first, then alphabetical by name
  all.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    const an = (a.first_name + ' ' + a.last_name).trim().toLowerCase();
    const bn = (b.first_name + ' ' + b.last_name).trim().toLowerCase();
    return an.localeCompare(bn);
  });

  // Summary
  const summary = {
    total: all.length,
    book: all.filter((x) => x.relationships.includes('book')).length,
    free_chapter: all.filter((x) => x.relationships.includes('free_chapter')).length,
    courses: all.filter((x) => x.relationships.includes('courses')).length,
    coaching: all.filter((x) => x.relationships.includes('coaching')).length,
    cohort: all.filter((x) => x.relationships.includes('cohort')).length,
    workshop: all.filter((x) => x.relationships.includes('workshop')).length,
    multi_relationship: all.filter((x) => x.depth >= 2).length,
  };

  return res.status(200).json({ contacts: all, summary, generated: new Date().toISOString() });
}
