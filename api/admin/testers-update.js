/**
 * Tester Admin: status update endpoint
 *
 * Body: { id: string, status: 'pending'|'invited'|'declined'|'maybe', star_notes?: string }
 * Auth: ?key=CRON_SECRET (same as testers-list)
 *
 * Updates tester_applications row. Stamps invited_at / declined_at
 * automatically when status changes to that.
 */

const ALLOWED_STATUSES = new Set(['pending', 'invited', 'declined', 'maybe', 'duplicate']);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase env vars missing' });
  }

  const { id, status, star_notes } = req.body || {};
  if (!id || !status) {
    return res.status(400).json({ error: 'id and status required' });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }

  const update = { status };
  if (typeof star_notes === 'string') update.star_notes = star_notes;
  if (status === 'invited') update.invited_at = new Date().toISOString();
  if (status === 'declined') update.declined_at = new Date().toISOString();

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/tester_applications?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(update),
      },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(500).json({ error: 'Supabase update failed', detail: text.slice(0, 240) });
    }
    const updated = await r.json();
    return res.status(200).json({ ok: true, row: Array.isArray(updated) ? updated[0] : updated });
  } catch (err) {
    return res.status(500).json({ error: 'Update exception', detail: String(err.message ?? err) });
  }
}
