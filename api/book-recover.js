/**
 * Book recovery — self-serve "I paid but didn't get my book."
 *
 * A buyer enters their email on /get-my-book. We look their purchase up
 * DIRECTLY in Stripe (the source of truth for who paid), find their paid book
 * checkout session, and re-send the download link email. This works even if the
 * original webhook never fired or the first email was lost — it does not depend
 * on any of our own delivery state, only on Stripe's payment record.
 *
 * Env vars:
 *   STRIPE_SECRET_KEY — to look up customers + their checkout sessions
 *   RESEND_API_KEY — to send the delivery email
 *   BOOK_PRICE_USD — optional, defaults to 2999 (fallback matcher for old sessions)
 *   STAR_NOTIFY_EMAIL — where recovery attempts are reported (defaults to star@)
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function stripeGet(path, secretKey) {
  const r = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!r.ok) {
    console.error('Stripe GET failed', path, r.status, (await r.text().catch(() => '')).slice(0, 200));
    return null;
  }
  return r.json();
}

// Is this paid checkout session the Emotional Fitness book?
function sessionIsPaidBook(session, bookPrice) {
  if (session.payment_status !== 'paid') return false;
  if (session?.metadata?.product === 'emotional-fitness-book') return true;
  // Fallback for sessions created before the metadata tag existed.
  return (session.amount_total || 0) === bookPrice;
}

async function sendBookEmail(toEmail, firstName, downloadUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY missing'); return false; }
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const text = [
    greeting,
    '',
    "Here's your book download link again:",
    '',
    downloadUrl,
    '',
    "Save it to your phone and your computer so you can read it anywhere, anytime.",
    '',
    "If you didn't know, I have a community where I teach weekly live calls to help you practically implement the tools from the book and answer your questions.",
    '',
    "It's called the Audacity Community because I want to help you have the audacity to live the life that you want to live.",
    '',
    "Here's a free one-week trial for you:",
    '',
    "https://www.skool.com/star-jesse-taylor-3703",
    '',
    "Star"
  ].join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Your book download link</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:36px 24px;background:#ffffff">
  <p style="font-size:16px;margin:0 0 20px">${greeting}</p>
  <p style="font-size:16px;margin:0 0 24px">Here is your book download link again:</p>
  <div style="text-align:center;margin:0 0 28px">
    <a href="${downloadUrl}" style="display:inline-block;background:#0D2C4F;color:#ffffff;padding:14px 32px;border-radius:100px;font-weight:800;text-decoration:none;font-size:16px">Download the Book</a>
  </div>
  <p style="font-size:15px;color:#4a5568;margin:0 0 32px">Save it to your phone and your computer so you can read it anywhere, anytime.</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:28px;margin-top:8px">
    <p style="font-size:16px;margin:0 0 18px;color:#333">If you didn't know, I have a community where I teach weekly live calls to help you practically implement the tools from the book and answer your questions.</p>
    <p style="font-size:16px;margin:0 0 16px;color:#333"><strong>Here's a free one-week trial for you:</strong></p>
    <div style="text-align:center;margin:0 0 12px">
      <a href="https://www.skool.com/star-jesse-taylor-3703" style="display:inline-block;background:#F2D5A6;color:#0D2C4F;padding:14px 32px;border-radius:100px;font-weight:900;text-decoration:none;font-size:15px;border:2px solid #0D2C4F">Try Audacity Free for 7 Days</a>
    </div>
  </div>
  <p style="font-size:16px;margin:36px 0 0">Star</p>
</div>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Taylor <star@starjessetaylor.com>',
        to: [toEmail],
        subject: 'Your book download link',
        text,
        html
      })
    });
    if (!res.ok) { console.error('Resend recovery send failed', await res.text()); return false; }
    return true;
  } catch (err) {
    console.error('Recovery send failed:', err);
    return false;
  }
}

async function notifyStar(email, outcome) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
  if (!apiKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Book Recovery <star@starjessetaylor.com>',
        to: [notifyTo],
        subject: `Book recovery: ${outcome} — ${email}`,
        text: `A buyer used the "get my book" recovery page.\n\nEmail: ${email}\nOutcome: ${outcome}\nTime: ${new Date().toISOString()}`
      })
    });
  } catch (err) { console.error('Recovery notify failed:', err); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { email, website_url } = body;

  if (body.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  // Honeypot: pretend success, do nothing.
  if (website_url) {
    return res.status(200).json({ sent: true });
  }

  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const cleanEmail = email.trim().toLowerCase();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('book-recover: STRIPE_SECRET_KEY missing');
    return res.status(500).json({ error: 'Recovery is not configured. Please email star@starjessetaylor.com.' });
  }

  try {
    // 1. Find Stripe customers with this email (checkout uses customer_creation:always).
    const customers = await stripeGet(`/customers?email=${encodeURIComponent(cleanEmail)}&limit=20`, secretKey);
    const customerIds = (customers?.data || []).map(c => c.id);

    const bookPrice = parseInt(process.env.BOOK_PRICE_USD || '2999', 10);
    const host = req.headers?.host || 'starjessetaylor.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    // 2. For each customer, scan their checkout sessions for a paid book purchase.
    let paidBookSession = null;
    for (const cid of customerIds) {
      const sessions = await stripeGet(`/checkout/sessions?customer=${encodeURIComponent(cid)}&limit=20`, secretKey);
      const match = (sessions?.data || []).find(s => sessionIsPaidBook(s, bookPrice));
      if (match) { paidBookSession = match; break; }
    }

    if (!paidBookSession) {
      await notifyStar(cleanEmail, 'NO PURCHASE FOUND');
      // Not found: tell them plainly so they know to reach out. A $30 ebook is not
      // sensitive enough to justify hiding this, and a false "sent" would leave a
      // real buyer waiting on an email that never comes.
      return res.status(200).json({
        sent: false,
        notFound: true,
        message: "We couldn't find a purchase under that email. If you used a different email at checkout, try that one, or email star@starjessetaylor.com and Star will sort it out."
      });
    }

    const firstName = paidBookSession.customer_details?.name?.split(' ')[0] || '';
    const toEmail = paidBookSession.customer_details?.email || cleanEmail;
    const bookUrl = `${protocol}://${host}/api/book-download?session_id=${encodeURIComponent(paidBookSession.id)}`;

    const ok = await sendBookEmail(toEmail, firstName, bookUrl);
    await notifyStar(cleanEmail, ok ? 'RESENT OK' : 'FOUND BUT SEND FAILED');

    if (!ok) {
      return res.status(200).json({
        sent: false,
        message: "We found your purchase but hit a snag sending the email. Please email star@starjessetaylor.com and Star will send it straight to you."
      });
    }

    return res.status(200).json({ sent: true, message: 'Your download link is on its way to your email. Check your inbox, including promotions and spam.' });
  } catch (err) {
    console.error('book-recover error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please email star@starjessetaylor.com.' });
  }
}
