// Stripe webhook handler.
//
// On checkout.session.completed:
//   1. Verifies the Stripe signature against STRIPE_WEBHOOK_SECRET.
//   2. Maps the purchase amount to a course (Self Worth / Breakthrough Blueprint).
//   3. Reads the source from session.client_reference_id (set by js/source-tracking.js).
//   4. Reads the "How did you hear about Star?" answer from session.custom_fields if present.
//   5. Creates or updates the contact in ActiveCampaign, adds them to the Master List,
//      applies course + source tags, and writes a note with full purchase context.
//
// Tags follow the existing convention from api/qualify.js (e.g. "Source: Instagram").
// Course tags applied per buyer:
//   - "Course Student"                        (matches existing legacy course-buyer segment)
//   - "Course Buyer: Self Worth"              (or "Course Buyer: Breakthrough Blueprint")
//
// Stripe sends raw bodies that need exact bytes for signature verification, so the
// default body parser is disabled below.

import crypto from 'crypto';

const LIST_ID = '3'; // Master Contact List

// Map total amount in cents to the course we sold.
// If you change a course price in Stripe, update this map too.
const COURSE_BY_AMOUNT = {
  9900:  { slug: 'self-worth',           name: 'Self Worth Course',           tag: 'Course Buyer: Self Worth' },
  15000: { slug: 'breakthrough-blueprint', name: 'Breakthrough Blueprint Course', tag: 'Course Buyer: Breakthrough Blueprint' }
};

// Map short source codes (used in URLs like ?from=ig) to the canonical AC tag.
// Matches the existing "Source: X" convention from qualify.js.
const SOURCE_TAGS = {
  ig:        'Source: Instagram',
  instagram: 'Source: Instagram',
  tt:        'Source: TikTok',
  tiktok:    'Source: TikTok',
  yt:        'Source: YouTube',
  youtube:   'Source: YouTube',
  email:     'Source: Email',
  pod:       'Source: Podcast',
  podcast:   'Source: Podcast',
  google:    'Source: Google',
  fb:        'Source: Facebook',
  facebook:  'Source: Facebook',
  x:         'Source: X',
  twitter:   'Source: X',
  threads:   'Source: Threads',
  referral:  'Source: Referral',
  direct:    'Source: Direct'
};

export const config = {
  api: { bodyParser: false }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = String(header).split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;

  const signedPayload = `${parts.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
  } catch {
    return false;
  }
}

async function getOrCreateTag(tagName, headers, baseUrl) {
  try {
    const search = await fetch(`${baseUrl}/api/3/tags?search=${encodeURIComponent(tagName)}`, { headers });
    if (search.ok) {
      const data = await search.json();
      const exact = (data.tags || []).find(t => t.tag === tagName);
      if (exact) return exact.id;
    }
    const create = await fetch(`${baseUrl}/api/3/tags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact', description: 'Auto-created from Stripe course purchase' } })
    });
    if (!create.ok) return null;
    const created = await create.json();
    return created.tag?.id || null;
  } catch (err) {
    console.error('getOrCreateTag error:', tagName, err);
    return null;
  }
}

async function applyTag(contactId, tagId, headers, baseUrl) {
  if (!tagId) return;
  await fetch(`${baseUrl}/api/3/contactTags`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
  }).catch(() => {});
}

function pickHowDidYouHear(customFields) {
  if (!Array.isArray(customFields)) return '';
  const match = customFields.find(f => {
    const label = (f?.label?.custom || f?.key || '').toLowerCase();
    return /hear|heard|where|find|found/.test(label);
  });
  if (!match) return '';
  return match?.dropdown?.value || match?.text?.value || match?.numeric?.value || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  if (!AC_KEY) {
    console.error('ACTIVECAMPAIGN_API_KEY not set');
    return res.status(500).json({ error: 'AC not configured' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('Failed to read raw body:', err);
    return res.status(400).json({ error: 'Could not read body' });
  }

  const sig = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    console.error('Invalid Stripe signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Only handle completed checkouts. Other events (refunds, disputes) can be added later.
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data?.object || {};
  const email = session?.customer_details?.email || session?.customer_email;
  const fullName = session?.customer_details?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  const amountTotal = session?.amount_total;
  const sourceRaw = (session?.client_reference_id || '').toLowerCase().trim();
  const sourceTag = SOURCE_TAGS[sourceRaw] || (sourceRaw ? `Source: ${sourceRaw.charAt(0).toUpperCase()}${sourceRaw.slice(1)}` : null);
  const orderId = session?.id;
  const sessionDate = new Date((session?.created || Math.floor(Date.now() / 1000)) * 1000).toISOString().split('T')[0];
  const howHeard = pickHowDidYouHear(session?.custom_fields);

  if (!email) {
    console.error('checkout.session.completed without email', orderId);
    return res.status(200).json({ received: true, error: 'no email' });
  }

  const course = COURSE_BY_AMOUNT[amountTotal] || {
    slug: 'unknown',
    name: `Unknown course (amount $${(amountTotal || 0) / 100})`,
    tag: null
  };

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Sync contact
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contact: { email, firstName } })
    });
    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync failed:', syncRes.status, text);
      return res.status(500).json({ error: 'AC sync failed' });
    }
    const { contact } = await syncRes.json();
    const contactId = contact?.id;
    if (!contactId) return res.status(500).json({ error: 'No AC contact ID' });

    // 2. Subscribe to Master Contact List
    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactList: { list: LIST_ID, contact: contactId, status: 1 } })
    }).catch(() => {});

    // 3. Build tag list
    const tagsToApply = ['Course Student']; // legacy catch-all, matches existing segment
    if (course.tag) tagsToApply.push(course.tag);
    if (sourceTag) tagsToApply.push(sourceTag);
    if (howHeard) tagsToApply.push(`Heard About: ${howHeard}`);

    // 4. Apply all tags in parallel (resolve IDs first)
    const tagIds = await Promise.all(tagsToApply.map(t => getOrCreateTag(t, headers, AC_URL)));
    await Promise.all(tagIds.map(id => applyTag(contactId, id, headers, AC_URL)));

    // 5. Write a note with full purchase context
    const noteLines = [
      `Stripe purchase: ${course.name}`,
      `Date: ${sessionDate}`,
      `Amount: $${((amountTotal || 0) / 100).toFixed(2)}`,
      sourceRaw ? `Source tag: ${sourceRaw} (${sourceTag || 'unmapped'})` : 'Source tag: not set',
      howHeard ? `Said they heard about Star via: ${howHeard}` : 'How they heard: not asked',
      `Stripe session: ${orderId}`
    ];
    await fetch(`${AC_URL}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: noteLines.join('\n'),
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(() => {});

    return res.status(200).json({
      received: true,
      contactId,
      course: course.slug,
      tagsApplied: tagsToApply
    });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
