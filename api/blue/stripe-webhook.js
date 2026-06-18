// Blue · Stripe Webhook Handler
// Receives Stripe webhook events on every successful payment.
// Sends a milestone email when ticket count crosses a threshold.

import {
  BLUE_CONFIG,
  callBlue,
  sendBlueEmail,
  fetchTotalEventTicketSales,
  daysUntilEvent
} from './_lib.js';

// Disable Vercel body parsing so we can read raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // Optional: verify Stripe signature
    // For V1 we'll verify using the webhook secret. If not set, we skip verification (less secure but simpler).
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret && sig) {
      const verified = await verifyStripeSignature(rawBody, sig, webhookSecret);
      if (!verified) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(rawBody);
    const obj = event.data?.object;
    const isPayment =
      event.type === 'charge.succeeded' || event.type === 'payment_intent.succeeded';

    // Branch 1: $500 Clarity Session ($50000 cents).
    // Star June 18 2026: webhook used to ignore everything but $97/$347 event
    // tickets, so $500 coaching buyers got silence after payment. Fix sends
    // Star a buyer notification + customer a "DM me to schedule" confirmation.
    const isClaritySession = isPayment && obj?.amount === 50000;
    if (isClaritySession) {
      const buyerEmail =
        obj?.receipt_email ||
        obj?.billing_details?.email ||
        obj?.charges?.data?.[0]?.billing_details?.email ||
        obj?.customer_email ||
        '';
      const buyerName =
        obj?.billing_details?.name ||
        obj?.charges?.data?.[0]?.billing_details?.name ||
        obj?.customer_details?.name ||
        '';
      await sendClaritySessionEmails(buyerEmail, buyerName);
      return res.status(200).json({ status: 'sent', type: 'clarity-session', buyerEmail });
    }

    // Branch 2: existing $97 GA / $347 VIP event ticket milestone path.
    const isTicketSale = isPayment && obj?.amount && (obj.amount === 9700 || obj.amount === 34700);
    if (!isTicketSale) {
      return res.status(200).json({ status: 'ignored', type: event.type });
    }

    // Pull current ticket count
    const ticketSales = await fetchTotalEventTicketSales();
    const total = ticketSales.total;

    // Check if total crosses a milestone
    if (!BLUE_CONFIG.milestoneCounts.includes(total)) {
      return res.status(200).json({ status: 'no milestone', total });
    }

    // Build milestone email
    const days = daysUntilEvent();
    const isSellout = total === BLUE_CONFIG.totalSeats;
    const subject = isSellout
      ? `Blue · SOLD OUT · May 30 LA event filled`
      : `Blue · Milestone · ${total} of ${BLUE_CONFIG.totalSeats} tickets sold`;

    const userPrompt = isSellout
      ? `The May 30 LA event just SOLD OUT. ${total} of ${BLUE_CONFIG.totalSeats} seats filled. ${days} days until the event.

Write Star a celebratory but tactical email. Structure:
1. Mark the moment. He should feel this.
2. Name what this proves about the model (cohort close potential, content authority, footage upside).
3. Recommend the ONE thing to focus on now that selling is done (preparation, content prep, cohort close prep).
4. Sign Blue.`
      : `The May 30 LA event just hit ${total} of ${BLUE_CONFIG.totalSeats} tickets sold. ${ticketSales.ga} GA and ${ticketSales.vip} VIP.

${days} days until event. ${BLUE_CONFIG.totalSeats - total} seats remaining.

Write Star a milestone email. Structure:
1. Acknowledge the milestone briefly (one line, do not over-celebrate)
2. Where this puts him on the trajectory to fill (math, honest)
3. The next milestone (next ${BLUE_CONFIG.milestoneCounts.find(m => m > total) || 'sellout'}) and what would unlock it
4. ONE recommended action right now
5. Sign Blue.`;

    const blueText = await callBlue(userPrompt, 1200);
    await sendBlueEmail(subject, blueText);

    return res.status(200).json({ status: 'sent', total, type: 'milestone' });

  } catch (err) {
    console.error('[Blue stripe-webhook] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================
// CLARITY SESSION POST-PAYMENT EMAILS
// ============================================================
// Fires on every successful $500 Stripe payment. Notifies Star + tells
// the buyer how to schedule (IG, TikTok, email). No Calendly, per Star's
// instruction: bookings happen via DM. Failures are logged but never
// returned to Stripe, otherwise Stripe retries forever.

async function sendClaritySessionEmails(buyerEmail, buyerName) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[clarity-session] RESEND_API_KEY missing, skipping emails');
    return;
  }

  const firstName = (buyerName || '').trim().split(/\s+/)[0] || '';
  const safeEmail = buyerEmail || '(no email captured)';
  const safeName = buyerName || '(no name captured)';

  // 1. Buyer confirmation (only if we actually have their email)
  if (buyerEmail) {
    const greeting = firstName ? `Hey ${firstName},` : 'Hey,';
    const text = [
      greeting,
      '',
      'Got your $500 Clarity Session payment. Looking forward to working with you.',
      '',
      'To schedule, DM me on Instagram @starjessetaylor (preferred). If you do not have Instagram, message me on TikTok @starjessetaylor instead. You can also just reply to this email at star@starjessetaylor.com.',
      '',
      'When you message me, send your time zone and a few times that work for you over the next 7 to 10 days. I will lock one in.',
      '',
      'Star'
    ].join('\n');

    const htmlParas = text.split('\n\n').map(p => {
      const safeP = p.replace(/\n/g, '<br/>');
      return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
    }).join('');
    const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParas}</div>`;

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
          to: [buyerEmail],
          reply_to: 'star@starjessetaylor.com',
          subject: firstName ? `${firstName}, your Clarity Session is booked` : 'Your Clarity Session is booked',
          html,
          text,
        }),
      });
      if (!r.ok) console.error('[clarity-session] buyer email failed', r.status, await r.text());
    } catch (err) {
      console.error('[clarity-session] buyer email threw', err);
    }
  }

  // 2. Star notification
  const starText = [
    'New $500 Clarity Session just paid.',
    '',
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    '',
    'They have been told to DM you on Instagram (preferred) or TikTok, or reply to the confirmation email at star@starjessetaylor.com.',
    '',
    'Watch your IG and TikTok DMs.',
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Clarity Session <hello@starjessetaylor.com>',
        to: ['star@starjessetaylor.com'],
        reply_to: buyerEmail || undefined,
        subject: `New $500 Clarity Session paid: ${safeName || safeEmail}`,
        text: starText,
      }),
    });
    if (!r.ok) console.error('[clarity-session] Star email failed', r.status, await r.text());
  } catch (err) {
    console.error('[clarity-session] Star email threw', err);
  }

  // 3. ActiveCampaign tag (non-blocking)
  await tagClaritySessionBuyer(buyerEmail, firstName, safeName).catch(err =>
    console.error('[clarity-session] AC tag failed', err)
  );
}

async function tagClaritySessionBuyer(email, firstName, fullName) {
  if (!email) return;
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  if (!AC_KEY) return;
  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };
  const lastName = fullName.split(/\s+/).slice(1).join(' ');
  const contactPayload = { email, firstName };
  if (lastName) contactPayload.lastName = lastName;
  const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
    method: 'POST', headers,
    body: JSON.stringify({ contact: contactPayload })
  });
  if (!syncRes.ok) return;
  const { contact } = await syncRes.json();
  const contactId = contact && contact.id;
  if (!contactId) return;
  const tagName = 'coaching:clarity-session-paid';
  const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, { headers });
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
}

// ============================================================
// STRIPE SIGNATURE VERIFICATION
// ============================================================

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  // Stripe-Signature: t=timestamp,v1=signature,v0=...
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k === 't') acc.timestamp = v;
    else if (k === 'v1') acc.v1 = v;
    return acc;
  }, {});

  if (!parts.timestamp || !parts.v1) return false;

  const signedPayload = `${parts.timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const sigHex = sigArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return sigHex === parts.v1;
}
