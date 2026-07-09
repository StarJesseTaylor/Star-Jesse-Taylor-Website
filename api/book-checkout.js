/**
 * Book checkout — creates a Stripe Checkout session for the Emotional Fitness book.
 *
 * Called from book.html's "Get the Book" button. Redirects the browser to
 * Stripe's hosted checkout page. On success, Stripe redirects back to
 * /book-thank-you.html?session_id={CHECKOUT_SESSION_ID} and fires the
 * webhook at /api/book-webhook (which sends the PDF + tags AC).
 *
 * Env vars used:
 *   STRIPE_SECRET_KEY — Stripe restricted key (charges:write + checkout:write + customers:write + payment_intents:write)
 *   BOOK_PRICE_USD — optional override, defaults to 2900 (cents = $29)
 *
 * Migrating away from Beacons (was starjessetaylor.bio/shop/...).
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const priceInCents = parseInt(process.env.BOOK_PRICE_USD || '2999', 10);
  const host = req.headers?.host || 'starjessetaylor.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const origin = `${protocol}://${host}`;

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${origin}/book-thank-you?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${origin}/book`);
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][product_data][name]', 'Emotional Fitness');
  params.append('line_items[0][price_data][product_data][description]', 'The complete book by Star Taylor');
  params.append('line_items[0][price_data][unit_amount]', String(priceInCents));
  params.append('line_items[0][quantity]', '1');
  // Collect email so the webhook knows where to send the PDF
  params.append('customer_creation', 'always');
  params.append('phone_number_collection[enabled]', 'false');
  params.append('allow_promotion_codes', 'true');
  params.append('billing_address_collection', 'auto');
  // Tag the session so the webhook can positively identify a book purchase and
  // never confuse it with other Stripe products (Clarity Session, event tickets).
  params.append('metadata[product]', 'emotional-fitness-book');
  // Enable order bump (optional upsells at checkout) later by adding line_items[1]

  try {
    const stripeRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('Stripe error:', data);
      return res.status(500).json({ error: data.error?.message || 'Stripe error' });
    }
    // Redirect the browser to Stripe's hosted checkout page
    if (req.method === 'GET') {
      res.setHeader('Location', data.url);
      return res.status(303).end();
    }
    return res.status(200).json({ url: data.url, id: data.id });
  } catch (err) {
    console.error('Checkout create error:', err);
    return res.status(500).json({ error: 'Could not create checkout session' });
  }
}
