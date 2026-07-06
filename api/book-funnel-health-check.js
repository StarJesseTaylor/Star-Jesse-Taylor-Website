// Book funnel health check.
// Verifies EVERY step of the book funnel every day.
// Cost: $0. Vercel cron + serverless functions are free within Star's Pro plan.
// Resend alert emails only fire on failure, minimal usage.
//
// If any step is broken, Star gets URGENT email at STAR_NOTIFY_EMAIL before
// a single customer hits a broken funnel.

export const config = { runtime: 'nodejs' };

const SITE_URL = process.env.SITE_URL || 'https://starjessetaylor.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STAR_NOTIFY_EMAIL = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>';

async function checkBookCheckout() {
  const url = `${SITE_URL}/api/book-checkout`;
  const t = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const elapsed = Date.now() - t;
    const location = res.headers.get('location') || '';
    if (res.status !== 303) return { name: 'book-checkout-status', ok: false, failReason: `Expected 303, got ${res.status}`, elapsed };
    if (!location.startsWith('https://checkout.stripe.com/c/pay/cs_live_')) {
      return { name: 'book-checkout-stripe-url', ok: false, failReason: `Redirect not to a live Stripe session: ${location.slice(0, 80)}`, elapsed };
    }
    return { name: 'book-checkout', ok: true, elapsed, detail: 'Redirects to live Stripe session' };
  } catch (err) {
    return { name: 'book-checkout', ok: false, failReason: err.message, elapsed: Date.now() - t };
  }
}

async function checkThankYouPage() {
  const url = `${SITE_URL}/book-thank-you`;
  const t = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - t;
    if (res.status !== 200) return { name: 'thank-you-page', ok: false, failReason: `Expected 200, got ${res.status}`, elapsed };
    const body = await res.text();
    // The thank-you page must tell the buyer the book is on the way
    if (!body.includes('got the book') && !body.includes('download link')) {
      return { name: 'thank-you-page-copy', ok: false, failReason: 'Thank-you page missing expected buyer-confirmation copy', elapsed };
    }
    return { name: 'thank-you-page', ok: true, elapsed };
  } catch (err) {
    return { name: 'thank-you-page', ok: false, failReason: err.message, elapsed: Date.now() - t };
  }
}

async function checkWebhookSecurity() {
  const url = `${SITE_URL}/api/book-webhook`;
  const t = Date.now();
  try {
    // Post junk. Webhook must REJECT (400 or 401), not accept.
    const res = await fetch(url, { method: 'POST', body: 'invalid' });
    const elapsed = Date.now() - t;
    if (res.status !== 400 && res.status !== 401) {
      return { name: 'webhook-security', ok: false, failReason: `Webhook should reject unsigned requests but returned ${res.status}`, elapsed };
    }
    return { name: 'webhook-security', ok: true, elapsed, detail: 'Rejects unsigned requests correctly' };
  } catch (err) {
    return { name: 'webhook-security', ok: false, failReason: err.message, elapsed: Date.now() - t };
  }
}

async function checkDownloadGate() {
  const url = `${SITE_URL}/api/book-download`;
  const t = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - t;
    // Download without session_id must be gated (400 or 403)
    if (res.status === 200) {
      return { name: 'download-gate', ok: false, failReason: 'Book download accessible without Stripe session — piracy risk!', elapsed };
    }
    return { name: 'download-gate', ok: true, elapsed, detail: `Gated with ${res.status}` };
  } catch (err) {
    return { name: 'download-gate', ok: false, failReason: err.message, elapsed: Date.now() - t };
  }
}

async function checkBookSalesPage() {
  const url = `${SITE_URL}/book`;
  const t = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - t;
    if (res.status !== 200) return { name: 'book-sales-page', ok: false, failReason: `Book page not loading, got ${res.status}`, elapsed };
    const body = await res.text();
    if (!body.includes('/api/book-checkout')) {
      return { name: 'book-sales-page-cta', ok: false, failReason: 'Book page missing Get Book CTA linking to /api/book-checkout', elapsed };
    }
    if (!body.includes('$29.99') && !body.includes('29.99')) {
      return { name: 'book-sales-page-price', ok: false, failReason: 'Book page missing $29.99 price', elapsed };
    }
    return { name: 'book-sales-page', ok: true, elapsed };
  } catch (err) {
    return { name: 'book-sales-page', ok: false, failReason: err.message, elapsed: Date.now() - t };
  }
}

async function sendAlert(failures) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY missing' };
  const subject = `URGENT: Book funnel broken (${failures.length} check${failures.length > 1 ? 's' : ''} failing)`;
  const body = [
    `Book funnel health check ran ${new Date().toISOString()}`,
    ``,
    `${failures.length} step${failures.length !== 1 ? 's' : ''} FAILED. Book buyers may be hitting a broken flow right now.`,
    ``,
    ...failures.map(f => `[FAIL] ${f.name} — ${f.failReason} (${f.elapsed}ms)`),
    ``,
    `Fix immediately. Every failed check = potential lost revenue.`,
    ``,
    `Site: ${SITE_URL}`,
    `Vercel logs: https://vercel.com/starjessetaylor/star-jesse-taylor-website/logs`,
  ].join('\n');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [STAR_NOTIFY_EMAIL],
      subject,
      text: body
    })
  });
  return { sent: resp.ok, status: resp.status };
}

export default async function handler(req, res) {
  const results = await Promise.all([
    checkBookSalesPage(),
    checkBookCheckout(),
    checkThankYouPage(),
    checkWebhookSecurity(),
    checkDownloadGate(),
  ]);
  const failures = results.filter(r => !r.ok);
  let alertResult = { sent: false };
  if (failures.length > 0) {
    alertResult = await sendAlert(failures);
  }
  const summary = {
    ran: new Date().toISOString(),
    totalChecks: results.length,
    passed: results.filter(r => r.ok).length,
    failed: failures.length,
    alerted: alertResult.sent,
    results
  };
  res.status(200).json(summary);
}
