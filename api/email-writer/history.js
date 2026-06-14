/**
 * Email Writer: history of past sends from ActiveCampaign.
 *
 * GET /api/email-writer/history?key=CRON_SECRET
 *
 * Returns:
 *   { campaigns: [{ id, name, subject, sent_date, total_recipients, opens, clicks, status }, ...] }
 *
 * Reads from AC's /api/3/campaigns endpoint, sorted newest first.
 * Star can scan his past sends, click to clone + send again with edits.
 */

const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

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
    const r = await fetch(`${AC_URL}/api/3/campaigns?orders[cdate]=DESC&limit=20`, {
      method: 'GET', headers,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return res.status(500).json({ error: 'AC fetch failed', detail: t.slice(0, 240) });
    }
    const data = await r.json();
    const campaigns = (data.campaigns || []).map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      cdate: c.cdate,
      sdate: c.sdate,
      status: c.status,
      total_amt: Number(c.total_amt ?? 0),
      opens: Number(c.opens ?? 0),
      uniqueopens: Number(c.uniqueopens ?? 0),
      linkclicks: Number(c.linkclicks ?? 0),
      uniquelinkclicks: Number(c.uniquelinkclicks ?? 0),
      send_amt: Number(c.send_amt ?? 0),
      ed_path: c.ed_path,
    }));

    return res.status(200).json({ campaigns, generated: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'History exception', detail: String(err.message ?? err) });
  }
}
