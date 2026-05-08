/**
 * Admin endpoint: audit and clean bot signups in ActiveCampaign.
 *
 * Auth: ?key=CRON_SECRET (matches existing admin/dashboard.js pattern)
 *
 * GET  → returns ALL contacts flagged as bot-like across the entire AC list
 *        (gibberish first OR last name pattern: 12+ char alphabetic, mixed case, no spaces)
 * POST → body { ids: [contactId, ...] } deletes those contacts from AC
 *
 * Bot detection rule:
 *   - firstName OR lastName matches /^[A-Za-z]{12,}$/ (long unbroken alphabetic string)
 *   - has both uppercase and lowercase characters (random-looking)
 *   - real human names virtually never look like this
 */

function isGibberish(name) {
  if (!name) return false;
  if (!/^[A-Za-z]{12,}$/.test(name)) return false;
  if (!/[A-Z]/.test(name)) return false;
  if (!/[a-z]/.test(name)) return false;
  return true;
}

async function getAllContacts(AC_URL, headers) {
  const all = [];
  let offset = 0;
  const limit = 100;
  const maxScan = 10000;

  while (true) {
    const url = `${AC_URL}/api/3/contacts?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) break;
    const data = await res.json();
    const contacts = data.contacts || [];
    all.push(...contacts);
    if (contacts.length < limit) break;
    offset += limit;
    if (offset >= maxScan) break;
  }
  return all;
}

async function deleteContact(AC_URL, headers, contactId) {
  const res = await fetch(`${AC_URL}/api/3/contacts/${contactId}`, {
    method: 'DELETE',
    headers
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized. Add ?key=YOUR_CRON_SECRET to the URL.' });
  }

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  if (!AC_KEY) return res.status(500).json({ error: 'ACTIVECAMPAIGN_API_KEY not set' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const contacts = await getAllContacts(AC_URL, headers);
      const suspects = contacts
        .filter(c => isGibberish(c.firstName) || isGibberish(c.lastName))
        .map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          createdUtc: c.cdate,
          flaggedField: isGibberish(c.firstName) ? 'firstName' : 'lastName'
        }));

      return res.status(200).json({
        scannedContacts: contacts.length,
        suspectCount: suspects.length,
        suspects
      });
    }

    if (req.method === 'POST') {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Body must include ids: [contactId, ...]' });
      }
      if (ids.length > 500) {
        return res.status(400).json({ error: 'Max 500 deletes per request. Split into batches.' });
      }

      const results = [];
      for (const id of ids) {
        const ok = await deleteContact(AC_URL, headers, id);
        results.push({ id, deleted: ok });
      }
      const deletedCount = results.filter(r => r.deleted).length;
      return res.status(200).json({
        deletedCount,
        failedCount: results.length - deletedCount,
        results
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Audit endpoint error:', err);
    return res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
}
