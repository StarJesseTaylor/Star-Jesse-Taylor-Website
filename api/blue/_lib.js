// Blue · Shared functions for autonomous email agent
// Used by daily-cron.js and stripe-webhook.js

// ============================================================
// CONFIG
// ============================================================

export const BLUE_CONFIG = {
  recipient: 'starjessetaylor@gmail.com',
  fromName: 'Blue',
  fromEmail: 'onboarding@resend.dev', // Resend's testing sender. Swap to blue@starjessetaylor.com after domain verification.
  eventDate: '2026-05-30T13:30:00-07:00',
  eventName: 'Stop the Mental Loop · LA Live Workshop',
  totalSeats: 30,
  gaSeats: 22,
  vipSeats: 8,
  countdownDays: [21, 14, 7, 3, 1],
  milestoneCounts: [1, 5, 10, 15, 20, 25, 30],
  interventionThresholdDays: 3,
  model: 'claude-opus-4-7'
};

// ============================================================
// BLUE'S CONDENSED SYSTEM PROMPT (for emails)
// ============================================================
// The full system prompt lives in C:\Users\starj\blue\system_prompt.md and is used
// in the Claude Project chat experience. This is a tighter version focused on email.

export const BLUE_EMAIL_SYSTEM_PROMPT = `You are Blue, Star Jesse Taylor's strategic mentor and chief of staff.

You speak with the gravitas of an older, wiser advisor. Warm but firm. You ask the questions that make Star think. You tell the truth even when uncomfortable. You never pander.

You synthesize the working frameworks of: Alex Hormozi (offers + money), Russell Brunson (funnels + story selling), Tony Robbins (stage + events), Steven Bartlett (podcast + brand), Chris Williamson (interviewing + distribution), Ed Lawrence (YouTube strategy), Caleb Ralston (premium production), Naval Ravikant (leverage + clarity), Donald Miller (StoryBrand), and Star Jesse Taylor at his best.

CONTEXT YOU ALWAYS HAVE:
- Star is a one-person Emotional Fitness coaching business. 1M+ social audience, ~4,200 buyer email list (mostly inactive).
- May 30, 2026 LA event live for sale. 30 seats, $97 GA (22 seats), $347 VIP (8 seats with private Zoom Clarity Session).
- Stage offer: $1,997 cohort closed from stage. $97 ticket credits toward cohort.
- Two prior LA events failed (broken AC, pre-Christmas timing). This one matters.
- Star's goals: $1M/month, 4M YouTube subs, Bartlett-tier podcast, fill events, buy a house, have a family.
- Star's mental health and family time are constraints, not variables.

VOICE RULES (HARD):
- NEVER use dashes (em or en). Use commas, periods, or new sentences. No exceptions.
- Direct, warm, zero fluff. No coachy clichés.
- Match Star's voice: someone who lived 14 years of OCD and speaks like a friend who walked the path.
- Be specific. Real numbers, real names, real next actions.
- One-person reality: every recommendation includes leverage (agent, automation, contractor).
- End with the smallest possible next physical action.

OUTPUT FORMAT:
You write email body text only. Plain prose. Short paragraphs.
Sign off "Blue" on its own line.
Do NOT include subject line in the body. Do NOT use markdown headers (#).
Do NOT use bullet point lists unless the content genuinely needs a list.`;

// ============================================================
// CALL CLAUDE API
// ============================================================

export async function callBlue(userPrompt, maxTokens = 1500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: BLUE_CONFIG.model,
      max_tokens: maxTokens,
      system: BLUE_EMAIL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ============================================================
// SEND EMAIL VIA RESEND
// ============================================================

export async function sendBlueEmail(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not set');

  // Convert plain text to simple HTML preserving paragraphs
  const htmlBody = body
    .split('\n\n')
    .map(p => `<p style="margin:0 0 16px;line-height:1.6;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const wrappedHtml = `<div style="max-width:620px;margin:0 auto;padding:24px;">${htmlBody}</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${BLUE_CONFIG.fromName} <${BLUE_CONFIG.fromEmail}>`,
      to: [BLUE_CONFIG.recipient],
      subject: subject,
      html: wrappedHtml,
      text: body
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }

  return await res.json();
}

// ============================================================
// FETCH STRIPE DATA
// ============================================================

export async function fetchStripeChargesLastDays(days) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY not set');

  const since = Math.floor((Date.now() - days * 86400000) / 1000);
  const url = `https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const successful = (data.data || []).filter(c => c.status === 'succeeded' && !c.refunded);

  return {
    count: successful.length,
    revenue: successful.reduce((sum, c) => sum + c.amount, 0) / 100, // cents to dollars
    charges: successful
  };
}

// Count successful event ticket sales (filters by amount: 9700 cents = $97 GA, 34700 cents = $347 VIP)
export async function fetchTotalEventTicketSales() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY not set');

  // Fetch last 90 days (event opened April 28, event May 30)
  const since = Math.floor((Date.now() - 90 * 86400000) / 1000);
  const url = `https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!res.ok) throw new Error(`Stripe API error ${res.status}`);
  const data = await res.json();

  const tickets = (data.data || []).filter(c =>
    c.status === 'succeeded' &&
    !c.refunded &&
    (c.amount === 9700 || c.amount === 34700)
  );

  return {
    total: tickets.length,
    ga: tickets.filter(c => c.amount === 9700).length,
    vip: tickets.filter(c => c.amount === 34700).length,
    revenue: tickets.reduce((sum, c) => sum + c.amount, 0) / 100
  };
}

// ============================================================
// AUTH HELPERS
// ============================================================

export function isAuthorizedCron(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader === `Bearer ${expected}`) return true;

  // Allow ?key= query param too (for manual browser testing)
  if (req.query?.key === expected) return true;

  return false;
}

// ============================================================
// DATE HELPERS
// ============================================================

export function daysUntilEvent() {
  const event = new Date(BLUE_CONFIG.eventDate);
  const diff = event.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function isPTSunday() {
  // Get day of week in PT (UTC-7 during PDT, UTC-8 during PST)
  // For simplicity, use UTC-7 (PDT) since most of the year is PDT
  const utcHours = new Date().getUTCHours();
  const ptHours = utcHours - 7;
  // If PT hours rolled negative, it's still the previous day in PT
  let ptDay = new Date().getUTCDay();
  if (ptHours < 0) ptDay = (ptDay + 6) % 7;
  return ptDay === 0;
}
