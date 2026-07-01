/**
 * Book webhook — fires when Stripe confirms a book purchase.
 *
 * Stripe POSTs to this endpoint with the checkout.session.completed event.
 * We then:
 *   1. Send the buyer their book PDF link via Resend
 *   2. Add them to ActiveCampaign as an "Emotional Fitness Book Buyer"
 *   3. Trigger the follow-up nurture sequence (Skool community pitch, etc.)
 *
 * Env vars used:
 *   STRIPE_WEBHOOK_SECRET — Stripe signing secret (from Stripe dashboard webhooks page)
 *   STRIPE_SECRET_KEY — for retrieving the full session object
 *   BOOK_PDF_URL — link to the book PDF (Vercel Blob signed URL, Google Drive, S3, whatever Star chooses)
 *   RESEND_API_KEY — for sending the delivery email
 *   ACTIVECAMPAIGN_API_URL, ACTIVECAMPAIGN_API_KEY — ActiveCampaign (matches the rest of the codebase)
 *   STAR_NOTIFY_EMAIL — where to send sale notifications (defaults to star@starjessetaylor.com)
 *
 * Configure the Stripe webhook at https://dashboard.stripe.com/webhooks:
 *   Endpoint URL: https://starjessetaylor.com/api/book-webhook
 *   Event: checkout.session.completed
 *   Copy the signing secret into Vercel as STRIPE_WEBHOOK_SECRET
 */

import crypto from 'crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const AC_DEFAULT_LIST_ID = '3';

// Verify Stripe signature. Raw body verification required.
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map(p => p.split('=').map(s => s.trim()))
  );
  const timestamp = parts.t;
  const sigs = [parts.v1].filter(Boolean);
  if (!timestamp || sigs.length === 0) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return sigs.some(s => crypto.timingSafeEqual(Buffer.from(s, 'hex'), Buffer.from(expected, 'hex')));
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function acFindOrCreateContact(AC_URL, headers, email, firstName) {
  const search = await fetch(`${AC_URL}/api/3/contacts?email=${encodeURIComponent(email)}`, {
    method: 'GET', headers
  });
  if (search.ok) {
    const data = await search.json();
    if (data.contacts && data.contacts.length > 0) return data.contacts[0].id;
  }
  const create = await fetch(`${AC_URL}/api/3/contacts`, {
    method: 'POST', headers,
    body: JSON.stringify({ contact: { email, firstName: firstName || '' } })
  });
  if (!create.ok) return null;
  const data = await create.json();
  return data.contact?.id ?? null;
}

async function acAddToList(AC_URL, headers, contactId, listId) {
  await fetch(`${AC_URL}/api/3/contactLists`, {
    method: 'POST', headers,
    body: JSON.stringify({ contactList: { list: listId, contact: contactId, status: 1 } })
  });
}

async function acApplyTag(AC_URL, headers, contactId, tagName) {
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET', headers
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find(t => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST', headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
      });
      if (create.ok) {
        const data = await create.json();
        tagId = data.tag && data.tag.id;
      }
    }
    if (!tagId) return;
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST', headers,
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

async function sendBookEmail(toEmail, firstName, downloadUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing');
    return;
  }
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const text = [
    greeting,
    '',
    "Your book is ready. Here's your download link:",
    '',
    downloadUrl,
    '',
    "Save it to your phone and your computer so you can read it anywhere, anytime.",
    '',
    "One thing before you dive in:",
    '',
    "I built a community called Audacity for people ready to actually live what the book teaches. Weekly calls with me, real teaching, real conversations. First 7 days are free.",
    '',
    "https://www.skool.com/star-jesse-taylor-3703",
    '',
    "Star"
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Taylor <star@starjessetaylor.com>',
        to: [toEmail],
        subject: 'Your book is ready',
        text
      })
    });
    if (!res.ok) console.error('Resend send failed', await res.text());
  } catch (err) {
    console.error('Send book email failed:', err);
  }
}

async function notifyStarOfSale(buyerEmail, buyerName, amountCents, sessionId, downloadUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
  if (!apiKey) return;
  const amount = (amountCents / 100).toFixed(2);
  const text = [
    `New book sale.`,
    '',
    `Buyer: ${buyerName || '(no name)'} <${buyerEmail}>`,
    `Amount: $${amount}`,
    `Time: ${new Date().toISOString()}`,
    '',
    `Stripe session: https://dashboard.stripe.com/payments/${sessionId}`,
    '',
    `Buyer's book download link (forward this if they say they didn't get it):`,
    downloadUrl,
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Book Sales <star@starjessetaylor.com>',
        to: [notifyTo],
        subject: `Book sold ($${amount}) — ${buyerEmail}`,
        text
      })
    });
  } catch (err) {
    console.error('Star notify failed:', err);
  }
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (webhookSecret) {
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      console.error('Invalid Stripe signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('STRIPE_WEBHOOK_SECRET not set — proceeding without verification (development mode only)');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ ignored: event.type });
  }

  const session = event.data.object;
  const email = session.customer_details?.email || session.customer_email;
  const firstName = session.customer_details?.name?.split(' ')[0] || '';

  if (!email) {
    console.error('No email on session', session.id);
    return res.status(200).json({ warning: 'No email' });
  }

  // Buyer downloads via the proxy endpoint using their session ID
  const host = req.headers?.host || 'starjessetaylor.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const bookUrl = `${protocol}://${host}/api/book-download?session_id=${encodeURIComponent(session.id)}`;

  // Fire everything in parallel (fire-and-forget where safe)
  // Env var names MUST match the rest of the codebase (audacity-waitlist, etc.)
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

  await sendBookEmail(email, firstName, bookUrl);
  await notifyStarOfSale(email, firstName, session.amount_total || 2999, session.id, bookUrl);

  if (AC_KEY) {
    const acHeaders = {
      'Api-Token': AC_KEY,
      'Content-Type': 'application/json'
    };
    try {
      const contactId = await acFindOrCreateContact(AC_URL, acHeaders, email, firstName);
      if (contactId) {
        await acAddToList(AC_URL, acHeaders, contactId, AC_DEFAULT_LIST_ID);
        // Ladder-machinery tags (drive AC automation flows):
        await acApplyTag(AC_URL, acHeaders, contactId, 'book-buyer');
        await acApplyTag(AC_URL, acHeaders, contactId, 'owns:emotional-fitness-book');
        // Historical convention tag (preserved for legacy segments):
        await acApplyTag(AC_URL, acHeaders, contactId, 'Emotional Fitness Book Buyer');
        // Source tracking:
        await acApplyTag(AC_URL, acHeaders, contactId, 'source:direct-website');
        await acApplyTag(AC_URL, acHeaders, contactId, 'path:book-purchase');
      }
    } catch (err) {
      console.error('AC integration failed:', err);
    }
  } else {
    console.warn('ACTIVECAMPAIGN_API_KEY missing — skipping AC integration. This means buyers pay but do not get tagged.');
  }

  return res.status(200).json({ received: true });
}
