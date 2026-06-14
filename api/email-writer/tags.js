/**
 * Email Writer: list ActiveCampaign tags with live contact counts.
 *
 * GET /api/email-writer/tags?key=CRON_SECRET
 *
 * Returns:
 *   { tags: [{ id, name, count }, ...] }
 *
 * Star June 14 2026. So he can pick "tester-tier-a" and immediately
 * see "28 contacts" without logging into AC.
 */

const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

async function fetchAllTags(headers) {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (let safety = 0; safety < 50; safety++) {
    const res = await fetch(`${AC_URL}/api/3/tags?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) break;
    const data = await res.json();
    const batch = data.tags || [];
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return out;
}

async function countContactsForTag(headers, tagId) {
  // AC's contact filter by tag returns up to limit per page. We do a
  // single page request with limit=100 and read the meta.total field
  // for the total count without enumerating every contact.
  const res = await fetch(`${AC_URL}/api/3/contacts?tagid=${tagId}&limit=1`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data.meta?.total ?? 0);
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

  try {
    const tags = await fetchAllTags(headers);

    // Parallel chunks of 10 to count contacts per tag without
    // overwhelming AC rate limits.
    const out = [];
    const chunkSize = 10;
    for (let i = 0; i < tags.length; i += chunkSize) {
      const chunk = tags.slice(i, i + chunkSize);
      const counts = await Promise.all(
        chunk.map((t) => countContactsForTag(headers, t.id).catch(() => 0)),
      );
      chunk.forEach((t, idx) => {
        out.push({
          id: t.id,
          name: t.tag,
          description: t.description || '',
          count: counts[idx],
        });
      });
    }

    // Sort: highest count first, then alphabetical
    out.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({ tags: out, totalTags: out.length });
  } catch (err) {
    return res.status(500).json({ error: 'Tag fetch failed', detail: String(err.message ?? err) });
  }
}
