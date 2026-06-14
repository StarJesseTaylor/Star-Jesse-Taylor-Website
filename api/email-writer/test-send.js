/**
 * Email Writer: test send to Star's inbox only.
 *
 * POST /api/email-writer/test-send?key=CRON_SECRET
 * Body: { subject: string, body: string }
 *
 * Sends the email straight to starjessetaylor@gmail.com via Resend so
 * Star can verify how it looks in his inbox before sending to a big
 * audience. Costs 1 email from the Resend quota.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STAR_EMAIL = 'starjessetaylor@gmail.com';

function bodyToHtml(plainBody) {
  // Simple paragraph wrapping for plain text. Splits on double newlines
  // for paragraphs, single newlines become <br>.
  const safe = plainBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = safe.split(/\n\s*\n/).map(p => p.replace(/\n/g, '<br/>'));
  const inner = paragraphs.map(p => `<p style="margin:0 0 18px;line-height:1.65;font-size:15.5px;color:#2C2C2C;">${p}</p>`).join('');
  return `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${inner}</div>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Resend key missing' });

  const { subject, body } = req.body || {};
  if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [STAR_EMAIL],
        subject: `[TEST] ${subject}`,
        html: bodyToHtml(body),
        text: body,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      return res.status(500).json({ error: 'Resend failed', detail: err.slice(0, 240) });
    }
    return res.status(200).json({ ok: true, sentTo: STAR_EMAIL });
  } catch (err) {
    return res.status(500).json({ error: 'Test send exception', detail: String(err.message ?? err) });
  }
}
