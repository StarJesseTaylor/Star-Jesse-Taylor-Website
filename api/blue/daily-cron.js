// Blue · Daily Cron Handler
// Scheduled by Vercel cron at 15:00 UTC (8 AM PT during PDT, 7 AM PST)
// Decides what type of email (if any) to send today.

import {
  BLUE_CONFIG,
  callBlue,
  sendBlueEmail,
  fetchStripeChargesLastDays,
  fetchTotalEventTicketSales,
  isAuthorizedCron,
  daysUntilEvent,
  isPTSunday
} from './_lib.js';

export default async function handler(req, res) {
  // Verify Vercel cron auth
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const days = daysUntilEvent();
    const isSunday = isPTSunday();
    const today = new Date().toISOString().split('T')[0];

    // Decide what to send today
    let emailType = null;

    // Allow ?force=sunday_letter|countdown|intervention for manual testing
    const forceType = req.query?.force;
    if (forceType && ['sunday_letter', 'countdown', 'intervention'].includes(forceType)) {
      emailType = forceType;
    } else if (isSunday) {
      emailType = 'sunday_letter';
    } else if (BLUE_CONFIG.countdownDays.includes(days)) {
      emailType = 'countdown';
    } else if (days > 1 && days < 30) {
      // Check intervention condition (3+ days no sales during launch window)
      const recentSales = await fetchStripeChargesLastDays(BLUE_CONFIG.interventionThresholdDays);
      const recentTickets = recentSales.charges.filter(c => c.amount === 9700 || c.amount === 34700);
      if (recentTickets.length === 0) {
        emailType = 'intervention';
      }
    }

    if (!emailType) {
      return res.status(200).json({ status: 'no email today', daysUntilEvent: days });
    }

    // Gather context for Blue
    const ticketSales = await fetchTotalEventTicketSales();
    const weekSales = await fetchStripeChargesLastDays(7);

    const context = {
      type: emailType,
      today,
      daysUntilEvent: days,
      ticketSales,
      weekSales,
      seatsRemaining: BLUE_CONFIG.totalSeats - ticketSales.total,
      gaRemaining: BLUE_CONFIG.gaSeats - ticketSales.ga,
      vipRemaining: BLUE_CONFIG.vipSeats - ticketSales.vip
    };

    // Build user prompt + subject by email type
    const { subject, userPrompt } = buildEmailRequest(emailType, context);

    // Get Blue's response
    const blueText = await callBlue(userPrompt, 1500);

    // Send email
    await sendBlueEmail(subject, blueText);

    return res.status(200).json({
      status: 'sent',
      type: emailType,
      daysUntilEvent: days,
      ticketSales: ticketSales.total
    });

  } catch (err) {
    console.error('[Blue daily-cron] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================
// EMAIL TYPE BUILDERS
// ============================================================

function buildEmailRequest(type, ctx) {
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (type === 'sunday_letter') {
    return {
      subject: `Blue · Sunday Letter · Week of ${fmtDate(ctx.today)}`,
      userPrompt: `It is Sunday. Write Star his weekly Strategic Letter.

THIS WEEK'S DATA:
- Tickets sold all-time: ${ctx.ticketSales.total} of 30 (${ctx.ticketSales.ga} GA, ${ctx.ticketSales.vip} VIP)
- Revenue from tickets all-time: $${ctx.ticketSales.revenue.toFixed(2)}
- Tickets sold this past week: ${ctx.weekSales.charges.filter(c => c.amount === 9700 || c.amount === 34700).length}
- Total revenue this past week (all products): $${ctx.weekSales.revenue.toFixed(2)}
- Days until May 30 LA event: ${ctx.daysUntilEvent}
- Seats remaining: ${ctx.seatsRemaining} of 30 (${ctx.gaRemaining} GA, ${ctx.vipRemaining} VIP)

Write the Sunday Letter as you described in your system prompt. Structure:
1. Open with one honest observation about where Star is in the campaign
2. Look at the week's data and draw 1-2 conclusions (not just describe numbers)
3. Ask 1 to 3 hard questions that make Star think
4. Recommend the focus for the coming week (one priority, not five)
5. Sign Blue.

Be a mentor. Warm but firm. Tell the truth. Compress.`
    };
  }

  if (type === 'countdown') {
    const tone = ctx.daysUntilEvent >= 14 ? 'momentum check' : ctx.daysUntilEvent >= 7 ? 'final push' : 'imminent';
    return {
      subject: `Blue · Countdown · ${ctx.daysUntilEvent} days to May 30`,
      userPrompt: `It is ${ctx.daysUntilEvent} days before the May 30 LA event. Write Star a countdown email.

CURRENT STATE:
- Tickets sold: ${ctx.ticketSales.total} of 30 (${ctx.ticketSales.ga} GA, ${ctx.ticketSales.vip} VIP)
- Seats remaining: ${ctx.seatsRemaining} of 30
- Days until event: ${ctx.daysUntilEvent}

Tone: ${tone}.

For T-21: trajectory check, encouragement, what should be true at T-14.
For T-14: status check, mid-campaign pivot if needed.
For T-7: final week intensity, what to push.
For T-3: pre-event prep, content batching, mental state.
For T-1: tomorrow is the day, final mental prep, what matters tonight.

Be specific to where the numbers actually are. If sales are ahead, say so. If behind, name it. Recommend ONE clear action for today. Sign Blue.`
    };
  }

  if (type === 'intervention') {
    return {
      subject: `Blue · Intervention · Sales stalled`,
      userPrompt: `Sales have stalled. Zero ticket sales in the past 3 days during an active launch window.

CURRENT STATE:
- Days since last sale: 3+
- Tickets sold so far: ${ctx.ticketSales.total} of 30
- Days until May 30 event: ${ctx.daysUntilEvent}
- Run rate needed to fill: ${(ctx.seatsRemaining / Math.max(1, ctx.daysUntilEvent)).toFixed(2)} per day

Write Star an intervention email. Structure:
1. Name what is happening, factually
2. Diagnose the most likely cause (3 possibilities, your top pick + why)
3. Prescribe the intervention (one specific action)
4. Tell Star what to do RIGHT NOW (not tomorrow)

Be direct. This is the moment to be the truth-telling mentor he needs. Sign Blue.`
    };
  }

  throw new Error(`Unknown email type: ${type}`);
}
