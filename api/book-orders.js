/**
 * Admin: book orders dashboard + resend.
 * Source of truth = Stripe. Lets Star see who paid, catch wrong emails, and
 * resend the book to the same OR a corrected email.
 *
 * Gated by ?key=CRON_SECRET (the de-facto admin password, same as other admin tools).
 *
 * GET  /api/book-orders?key=...            -> recent paid book orders
 * POST /api/book-orders  { key, session_id, email? } -> resend book (email optional = correct a wrong address)
 *
 * Env: STRIPE_SECRET_KEY, CRON_SECRET, RESEND_API_KEY, BOOK_PRICE_USD (default 2999)
 */

import crypto from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
// Scoped book-orders access token (sha256 hash only; raw token never stored in repo).
// Lets Star open the dashboard on his phone without the powerful CRON_SECRET.
const BOOK_KEY_HASH = '9209d9d7159226e12ac705ac4f3515a0f22080b4bc3089c75b3fc037f7d96bee';

async function stripeGet(path) {
  const r = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

// Same book email Star already approved (mirrors api/book-webhook.js).
async function sendBookEmail(toEmail, firstName, downloadUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY missing' };
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const text = [
    greeting, '',
    "Your book is ready. Here's your download link:", '',
    downloadUrl, '',
    "Save it to your phone and your computer so you can read it anywhere, anytime.", '',
    "If you didn't know, I have a community where I teach weekly live calls to help you practically implement the tools from the book and more and answer your questions so you have more support with your challenges and goals.", '',
    "It's called the Audacity Community because I want to help you have the audacity to live the life that you want to live.", '',
    "Here's a free one-week trial for you:", '',
    "https://www.skool.com/star-jesse-taylor-3703", '',
    "Then $49/month. Cancel anytime.", '',
    "Star"
  ].join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Your book is ready</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:36px 24px;background:#ffffff">
  <p style="font-size:16px;margin:0 0 20px">${greeting}</p>
  <p style="font-size:16px;margin:0 0 12px"><strong>Your book is ready.</strong></p>
  <p style="font-size:16px;margin:0 0 24px">Here is your download link:</p>
  <div style="text-align:center;margin:0 0 28px">
    <a href="${downloadUrl}" style="display:inline-block;background:#0D2C4F;color:#ffffff;padding:14px 32px;border-radius:100px;font-weight:800;text-decoration:none;font-size:16px">Download the Book</a>
  </div>
  <p style="font-size:15px;color:#4a5568;margin:0 0 32px">Save it to your phone and your computer so you can read it anywhere, anytime.</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:28px;margin-top:8px">
    <p style="font-size:16px;margin:0 0 18px;color:#333">If you didn't know, I have a community where I teach weekly live calls to help you practically implement the tools from the book and more and answer your questions so you have more support with your challenges and goals.</p>
    <p style="font-size:16px;margin:0 0 22px;color:#333">It's called the Audacity Community because I want to help you have the audacity to live the life that you want to live.</p>
    <p style="font-size:16px;margin:0 0 16px;color:#333"><strong>Here's a free one-week trial for you:</strong></p>
    <div style="text-align:center;margin:0 0 12px">
      <a href="https://www.skool.com/star-jesse-taylor-3703" style="display:inline-block;background:#F2D5A6;color:#0D2C4F;padding:14px 32px;border-radius:100px;font-weight:900;text-decoration:none;font-size:15px;border:2px solid #0D2C4F">Try Audacity Free for 7 Days</a>
    </div>
    <p style="font-size:13px;color:#718096;text-align:center;margin:0">Then $49/month. Cancel anytime.</p>
  </div>
  <p style="font-size:16px;margin:36px 0 0">Star</p>
</div>
</body></html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Star Taylor <star@starjessetaylor.com>', to: [toEmail], subject: 'Your book is ready', text, html })
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export default async function handler(req, res) {
  const key = req.query?.key || req.body?.key || '';
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const authed = (process.env.CRON_SECRET && key === process.env.CRON_SECRET) || keyHash === BOOK_KEY_HASH;
  if (!authed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const bookPrice = parseInt(process.env.BOOK_PRICE_USD || '2999', 10);

  if (req.method === 'GET') {
    // Pull recent checkout sessions (last few hundred), keep the paid book ones.
    let orders = [];
    let starting_after = '';
    for (let page = 0; page < 3; page++) {
      const q = `/checkout/sessions?limit=100${starting_after ? `&starting_after=${starting_after}` : ''}`;
      const { status, body } = await stripeGet(q);
      if (status >= 300 || !body.data) break;
      for (const s of body.data) {
        if (s.payment_status !== 'paid') continue;
        const isBook = s.amount_total === bookPrice || s.metadata?.product === 'emotional-fitness-book';
        if (!isBook) continue;
        orders.push({
          id: s.id,
          email: s.customer_details?.email || s.customer_email || null,
          name: s.customer_details?.name || null,
          amount: (s.amount_total || 0) / 100,
          created: new Date(s.created * 1000).toISOString()
        });
      }
      if (!body.has_more) break;
      starting_after = body.data[body.data.length - 1]?.id;
      if (!starting_after) break;
    }
    return res.status(200).json({ count: orders.length, orders });
  }

  if (req.method === 'POST') {
    const { session_id, email } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const { status, body: session } = await stripeGet(`/checkout/sessions/${session_id}`);
    if (status >= 300 || !session?.id) return res.status(404).json({ error: 'Order not found in Stripe' });
    const toEmail = (email || session.customer_details?.email || session.customer_email || '').trim();
    if (!toEmail) return res.status(400).json({ error: 'No email to send to' });
    const firstName = (session.customer_details?.name || '').split(' ')[0] || '';
    const downloadUrl = `https://starjessetaylor.com/api/book-download?session_id=${encodeURIComponent(session_id)}`;
    const result = await sendBookEmail(toEmail, firstName, downloadUrl);
    if (!result.ok) return res.status(500).json({ error: 'Send failed', detail: result.error });
    return res.status(200).json({ success: true, sentTo: toEmail });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
