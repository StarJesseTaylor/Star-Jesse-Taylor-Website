/**
 * Book buyer backfill endpoint.
 *
 * URGENT: The book webhook has been silently failing to add buyers to
 * ActiveCampaign. This endpoint pulls every successful book Stripe payment,
 * adds each buyer to AC with the proper book-buyer tags, and reports back.
 *
 * Safe to run repeatedly - acFindOrCreateContact is idempotent and applying
 * tags is idempotent too. Running it twice does NOT duplicate contacts.
 *
 * Usage:
 *   GET /api/book-buyer-backfill?key=<CRON_SECRET>&days=30
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY - for reading Stripe payments
 *   ACTIVECAMPAIGN_API_URL, ACTIVECAMPAIGN_API_KEY - AC creds
 *   CRON_SECRET - auth for admin endpoint
 *
 * Returns JSON:
 *   {
 *     scanned: number of Stripe payments checked,
 *     bookBuyers: number of $29.99 payments identified as book buyers,
 *     addedToAC: number successfully added to AC,
 *     alreadyInAC: number already existed (idempotent updates),
 *     failed: number that errored,
 *     failures: [{ email, reason }],
 *     buyers: [{ email, firstName, addedAt, stripeId, status }]
 *   }
 */

export const config = { runtime: 'nodejs', maxDuration: 60 };

const AC_LIST_ID = '3';
const BOOK_PRICE_CENTS = [2999, 2900]; // $29.99 current, $29.00 legacy

async function acReq(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

async function acFindOrCreateContact(AC_URL, headers, email, firstName) {
  const search = await acReq(`${AC_URL}/api/3/contacts?email=${encodeURIComponent(email)}`, { method: 'GET', headers });
  if (search.ok && search.body.contacts?.length) return { id: search.body.contacts[0].id, existed: true };
  const create = await acReq(`${AC_URL}/api/3/contacts`, {
    method: 'POST', headers,
    body: JSON.stringify({ contact: { email, firstName: firstName || '' } })
  });
  if (!create.ok) {
    throw new Error(`AC contact create failed (${create.status}): ${JSON.stringify(create.body).slice(0, 200)}`);
  }
  return { id: create.body.contact?.id, existed: false };
}

async function acAddToList(AC_URL, headers, contactId, listId) {
  await acReq(`${AC_URL}/api/3/contactLists`, {
    method: 'POST', headers,
    body: JSON.stringify({ contactList: { list: listId, contact: contactId, status: 1 } })
  });
}

async function acApplyTag(AC_URL, headers, contactId, tagName) {
  const search = await acReq(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, { method: 'GET', headers });
  let tagId = null;
  if (search.ok && search.body.tags?.length) {
    tagId = search.body.tags.find(t => t.tag === tagName)?.id;
  }
  if (!tagId) {
    const create = await acReq(`${AC_URL}/api/3/tags`, {
      method: 'POST', headers,
      body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
    });
    tagId = create.body.tag?.id;
  }
  if (!tagId) return;
  await acReq(`${AC_URL}/api/3/contactTags`, {
    method: 'POST', headers,
    body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
  });
}

async function fetchAllStripeBookPayments(stripeKey, days) {
  const buyers = [];
  const cutoff = Math.floor((Date.now() - days * 86400_000) / 1000);
  let startingAfter = null;
  let scanned = 0;
  while (true) {
    const params = new URLSearchParams({
      limit: '100',
      'created[gte]': String(cutoff)
    });
    if (startingAfter) params.append('starting_after', startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params}`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    });
    if (!res.ok) throw new Error(`Stripe API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    scanned += data.data.length;
    for (const s of data.data) {
      if (s.payment_status !== 'paid') continue;
      if (!BOOK_PRICE_CENTS.includes(s.amount_total)) continue;
      const email = s.customer_details?.email || s.customer_email;
      const name = s.customer_details?.name || '';
      if (!email) continue;
      buyers.push({
        stripeId: s.id,
        email,
        firstName: name.split(' ')[0] || '',
        fullName: name,
        amountCents: s.amount_total,
        createdAt: new Date(s.created * 1000).toISOString()
      });
    }
    if (!data.has_more) break;
    startingAfter = data.data[data.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return { scanned, buyers };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const key = req.query?.key || (req.url?.includes('key=') ? new URL(req.url, 'http://x').searchParams.get('key') : null);
  // Accept EITHER ?key=CRON_SECRET (manual/admin call) OR the Authorization: Bearer
  // <CRON_SECRET> header that Vercel automatically attaches to scheduled cron
  // invocations. This lets the daily safety-net cron (vercel.json) run without
  // putting the secret in the repo.
  const authHeader = req.headers?.authorization || '';
  const keyOk = secret && key === secret;
  const bearerOk = secret && authHeader === `Bearer ${secret}`;
  if (!secret || (!keyOk && !bearerOk)) return res.status(403).json({ error: 'forbidden' });

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || '').replace(/\/$/, '');
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const daysStr = req.query?.days || new URL(req.url || '', 'http://x').searchParams.get('days') || '30';
  const days = Math.min(365, Math.max(1, parseInt(daysStr, 10) || 30));

  if (!STRIPE_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY missing' });
  if (!AC_URL || !AC_KEY) {
    return res.status(500).json({
      error: 'ActiveCampaign creds missing',
      hint: 'Set ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_KEY in Vercel env vars for Production',
      AC_URL_present: !!AC_URL,
      AC_KEY_present: !!AC_KEY
    });
  }

  let stripeResult;
  try {
    stripeResult = await fetchAllStripeBookPayments(STRIPE_KEY, days);
  } catch (err) {
    return res.status(500).json({ error: 'Stripe query failed', detail: err.message });
  }
  const { scanned, buyers } = stripeResult;
  const acHeaders = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };
  const tags = ['book-buyer', 'owns:emotional-fitness-book', 'Emotional Fitness Book Buyer', 'source:direct-website', 'path:book-purchase'];

  let addedToAC = 0, alreadyInAC = 0, failed = 0;
  const failures = [];
  const results = [];

  for (const buyer of buyers) {
    try {
      const { id: contactId, existed } = await acFindOrCreateContact(AC_URL, acHeaders, buyer.email, buyer.firstName);
      if (!contactId) throw new Error('No contactId returned');
      if (existed) alreadyInAC++; else addedToAC++;
      await acAddToList(AC_URL, acHeaders, contactId, AC_LIST_ID);
      for (const tag of tags) await acApplyTag(AC_URL, acHeaders, contactId, tag);
      results.push({
        email: buyer.email,
        name: buyer.fullName,
        stripeId: buyer.stripeId,
        contactId,
        existed,
        purchasedAt: buyer.createdAt,
        status: 'added-with-tags'
      });
    } catch (err) {
      failed++;
      failures.push({ email: buyer.email, stripeId: buyer.stripeId, reason: err.message });
    }
  }

  return res.status(200).json({
    ranAt: new Date().toISOString(),
    daysScanned: days,
    scanned,
    bookBuyersFound: buyers.length,
    addedToAC,
    alreadyInAC,
    failed,
    failures,
    results
  });
}
