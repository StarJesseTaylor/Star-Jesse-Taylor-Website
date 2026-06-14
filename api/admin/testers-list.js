/**
 * Tester Admin: list endpoint
 *
 * Returns all tester applicants from Supabase tester_applications,
 * sorted by tier (A first), then created_at desc. Auth via ?key= using
 * the same CRON_SECRET as the live dashboard so Star doesn't need to
 * remember a second password.
 *
 * Star June 14 2026: "I have so many applications, how are we going to
 * filter them" — this powers /admin/testers.html which lets him triage
 * in one place.
 */

const TIER_ORDER = { a: 0, b: 1, c: 2, waitlist: 3 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized. Add ?key=YOUR_CRON_SECRET to the URL.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase env vars missing on Vercel' });
  }

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/tester_applications?select=*&order=created_at.desc&limit=500`,
      {
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
      },
    );
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(500).json({ error: 'Supabase fetch failed', detail: text.slice(0, 240) });
    }
    const rows = await r.json();

    // Sort by tier (A first), then created_at desc.
    rows.sort((a, b) => {
      const ta = TIER_ORDER[a.tier] ?? 9;
      const tb = TIER_ORDER[b.tier] ?? 9;
      if (ta !== tb) return ta - tb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Summary counts for the dashboard header.
    const summary = {
      total: rows.length,
      tier_a: rows.filter((r) => r.tier === 'a').length,
      tier_b: rows.filter((r) => r.tier === 'b').length,
      tier_c: rows.filter((r) => r.tier === 'c').length,
      pending: rows.filter((r) => r.status === 'pending').length,
      invited: rows.filter((r) => r.status === 'invited').length,
      declined: rows.filter((r) => r.status === 'declined').length,
      iphone: rows.filter((r) => r.device === 'iphone').length,
      android: rows.filter((r) => r.device === 'android').length,
    };

    return res.status(200).json({ rows, summary, generated: new Date().toISOString() });
  } catch (err) {
    console.error('testers-list error:', err);
    return res.status(500).json({ error: 'List fetch exception', detail: String(err.message ?? err) });
  }
}
