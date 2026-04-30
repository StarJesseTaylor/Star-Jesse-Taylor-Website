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

    // Only handle successful charges/payments for the event ticket products
    const isTicketSale =
      (event.type === 'charge.succeeded' || event.type === 'payment_intent.succeeded') &&
      event.data?.object?.amount &&
      (event.data.object.amount === 9700 || event.data.object.amount === 34700);

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
