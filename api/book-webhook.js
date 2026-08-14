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
const COURSE_NAME = 'How to Create a Healthy Relationship';
const COURSE_ACCESS_URL = 'https://starjessetaylor.com/healthy-relationship-access-3p8x7m9k.html';

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
    "If you didn't know, I have a community where I teach weekly live calls to help you practically implement the tools from the book and more and answer your questions so you have more support with your challenges and goals.",
    '',
    "It's called the Audacity Community because I want to help you have the audacity to live the life that you want to live.",
    '',
    "Here's a free one-week trial for you:",
    '',
    "https://www.skool.com/star-jesse-taylor-3703",
    '',
    "Then $49/month. Cancel anytime.",
    '',
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
      body: JSON.stringify({
        from: 'Star Taylor <star@starjessetaylor.com>',
        to: [toEmail],
        subject: 'Your book is ready',
        text,
        html
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

// Positively identify a book purchase. Book checkout sessions are created by
// api/book-checkout.js with product name "Emotional Fitness" and (going forward)
// metadata.product = "emotional-fitness-book". Everything else that hits this
// endpoint (the $500 Clarity Session, $97/$347 event tickets, future products)
// is NOT a book and must not trigger book delivery / book-buyer tagging.
async function sessionIsBook(session) {
  if (session?.metadata?.product === 'emotional-fitness-book') return true;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    try {
      const r = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${session.id}/line_items?limit=10`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      if (r.ok) {
        const data = await r.json();
        const names = (data.data || []).map(li => (li.description || '').toLowerCase());
        if (names.some(n => n.includes('emotional fitness'))) return true;
        if (names.length > 0) return false; // has line items, none are the book
      }
    } catch (err) {
      console.error('book-webhook: line_items lookup failed, falling back to price check', err);
    }
  }

  // Backstop when line items can't be inspected: only the exact book price counts,
  // so coaching ($500) and event ($97/$347) amounts never slip through as books.
  const bookPrice = parseInt(process.env.BOOK_PRICE_USD || '2999', 10);
  return (session.amount_total || 0) === bookPrice;
}

// ── Healthy Relationship course delivery ───────────────────────────────
// This endpoint receives EVERY checkout.session.completed (book, course,
// coaching, event tickets). The book path above handles books; this handles
// the Healthy Relationship course. Matched by line-item name, because $37 is
// not a unique amount (other courses can share it) — never by amount alone.
async function sessionIsHealthyRelationshipCourse(session) {
  if (session?.metadata?.product === 'healthy-relationship-course') return true;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    try {
      const r = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${session.id}/line_items?limit=10`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      if (r.ok) {
        const data = await r.json();
        const names = (data.data || []).map(li => (li.description || '').toLowerCase());
        if (names.some(n => n.includes('healthy relationship'))) return true;
      }
    } catch (err) {
      console.error('course-id: line_items lookup failed', err);
    }
  }
  return false;
}

async function sendCourseEmail(toEmail, firstName, accessUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY missing'); return; }
  const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
  const text = [
    greeting, '',
    `Your course is ready: ${COURSE_NAME}.`, '',
    "Here's your private access link:", '',
    accessUrl, '',
    'Bookmark this page so you can come back anytime. Watch it, pause it, and return to any part as often as you want. You have lifetime access.', '',
    "If you're not already inside, I run a community with weekly live calls where I answer your questions and help you apply this to your own life. Here is a free one-week trial:", '',
    'https://www.skool.com/star-jesse-taylor-3703', '',
    'Star'
  ].join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Your course is ready</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.55">
<div style="max-width:560px;margin:0 auto;padding:36px 24px;background:#ffffff">
  <p style="font-size:16px;margin:0 0 20px">${greeting}</p>
  <p style="font-size:16px;margin:0 0 12px"><strong>Your course is ready: ${COURSE_NAME}.</strong></p>
  <p style="font-size:16px;margin:0 0 24px">Here is your private access link:</p>
  <div style="text-align:center;margin:0 0 24px">
    <a href="${accessUrl}" style="display:inline-block;background:#4a1942;color:#ffffff;padding:14px 32px;border-radius:100px;font-weight:800;text-decoration:none;font-size:16px">Watch the Course</a>
  </div>
  <p style="font-size:15px;color:#4a5568;margin:0 0 32px">Bookmark this page so you can come back anytime. Watch it, pause it, and return to any part as often as you want. You have lifetime access.</p>
  <div style="border-top:1px solid #e2e8f0;padding-top:28px;margin-top:8px">
    <p style="font-size:15px;margin:0 0 16px;color:#333">If you're not already inside, I run a community with weekly live calls where I answer your questions and help you apply this to your own life.</p>
    <div style="text-align:center;margin:0 0 6px">
      <a href="https://www.skool.com/star-jesse-taylor-3703" style="display:inline-block;background:#F2D5A6;color:#0D2C4F;padding:12px 28px;border-radius:100px;font-weight:900;text-decoration:none;font-size:14px;border:2px solid #0D2C4F">Try the Community Free for 7 Days</a>
    </div>
  </div>
  <p style="font-size:16px;margin:32px 0 0">Star</p>
</div>
</body></html>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Taylor <star@starjessetaylor.com>',
        to: [toEmail],
        subject: 'Your course is ready — How to Create a Healthy Relationship',
        text, html
      })
    });
    if (!res.ok) console.error('Resend course send failed', await res.text());
  } catch (err) { console.error('Send course email failed:', err); }
}

async function notifyStarOfCourseSale(buyerEmail, buyerName, amountCents, sessionId) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
  if (!apiKey) return;
  const amount = (amountCents / 100).toFixed(2);
  const text = [
    `New course sale: ${COURSE_NAME}.`, '',
    `Buyer: ${buyerName || '(no name)'} <${buyerEmail}>`,
    `Amount: $${amount}`,
    `Time: ${new Date().toISOString()}`, '',
    `Stripe session: https://dashboard.stripe.com/payments/${sessionId}`, '',
    `Access link (forward if they say they didn't get it):`,
    COURSE_ACCESS_URL,
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Course Sales <star@starjessetaylor.com>',
        to: [notifyTo],
        subject: `Course sold ($${amount}) — ${buyerEmail}`,
        text
      })
    });
  } catch (err) { console.error('Course notify failed:', err); }
}

async function handleHealthyRelationshipCourse(res, session) {
  const email = session.customer_details?.email || session.customer_email;
  const firstName = session.customer_details?.name?.split(' ')[0] || '';
  if (!email) {
    console.error('No email on course session', session.id);
    return res.status(200).json({ warning: 'No email' });
  }
  await sendCourseEmail(email, firstName, COURSE_ACCESS_URL);
  await notifyStarOfCourseSale(email, firstName, session.amount_total || 3700, session.id);

  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  if (AC_KEY) {
    const acHeaders = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };
    try {
      const contactId = await acFindOrCreateContact(AC_URL, acHeaders, email, firstName);
      if (contactId) {
        await acAddToList(AC_URL, acHeaders, contactId, AC_DEFAULT_LIST_ID);
        await acApplyTag(AC_URL, acHeaders, contactId, 'course-buyer');
        await acApplyTag(AC_URL, acHeaders, contactId, 'owns:healthy-relationship-course');
        await acApplyTag(AC_URL, acHeaders, contactId, 'source:direct-website');
        await acApplyTag(AC_URL, acHeaders, contactId, 'path:course-purchase');
      }
    } catch (err) { console.error('AC course integration failed:', err); }
  } else {
    console.warn('ACTIVECAMPAIGN_API_KEY missing — course buyer paid but was not tagged.');
  }
  return res.status(200).json({ received: true, product: 'healthy-relationship-course' });
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

  // Guard: only real book purchases trigger book delivery + book-buyer tagging.
  // The $500 Clarity Session and $97/$347 event tickets ALSO fire
  // checkout.session.completed; they were being mislabeled as book sales, sending
  // coaching/event buyers a "Your book is ready" email and tagging them as
  // book-buyers in ActiveCampaign. Positively identify the book first.
  if (!(await sessionIsBook(session))) {
    // Not a book. Is it the Healthy Relationship course? (same endpoint gets all events)
    if (await sessionIsHealthyRelationshipCourse(session)) {
      return await handleHealthyRelationshipCourse(res, session);
    }
    console.log('book-webhook: ignoring non-book, non-course checkout', session.id, session.amount_total);
    return res.status(200).json({ ignored: 'not-a-known-product', amount: session.amount_total });
  }

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
