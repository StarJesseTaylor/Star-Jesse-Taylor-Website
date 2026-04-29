// Admin Dashboard · Live business analytics endpoint
// Returns JSON consumed by /admin/dashboard.html
// Auth via query param: ?key=CRON_SECRET

import {
  fetchTotalEventTicketSales,
  fetchStripeChargesLastDays,
  daysUntilEvent,
  BLUE_CONFIG
} from '../blue/_lib.js';

export default async function handler(req, res) {
  // CORS headers (so the HTML dashboard can fetch even on different domains)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized. Add ?key=YOUR_CRON_SECRET to the URL.' });
  }

  try {
    const [tickets, week, today, last30] = await Promise.all([
      fetchTotalEventTicketSales(),
      fetchStripeChargesLastDays(7),
      fetchStripeChargesLastDays(1),
      fetchStripeChargesLastDays(30)
    ]);

    const days = daysUntilEvent();
    const seatsRemaining = BLUE_CONFIG.totalSeats - tickets.total;
    const runRateNeeded = days > 0 ? seatsRemaining / days : 0;

    // Filter for ticket sales only ($97 GA or $347 VIP)
    const isTicket = (c) => c.amount === 9700 || c.amount === 34700;

    const todayTickets = today.charges.filter(isTicket);
    const weekTickets = week.charges.filter(isTicket);
    const last30Tickets = last30.charges.filter(isTicket);

    // Recent sales feed (last 10 ticket sales)
    const recentSales = last30Tickets.slice(0, 10).map(c => ({
      amount: c.amount / 100,
      tier: c.amount === 9700 ? 'GA' : 'VIP',
      date: new Date(c.created * 1000).toISOString(),
      customerEmail: c.billing_details?.email || c.receipt_email || 'unknown',
      customerName: c.billing_details?.name || 'unknown'
    }));

    // Project fill date based on last 7 days run rate
    const last7Velocity = weekTickets.length / 7; // tickets per day
    const daysToFill = last7Velocity > 0 ? Math.ceil(seatsRemaining / last7Velocity) : null;
    const projectedFillDate = daysToFill ? new Date(Date.now() + daysToFill * 86400000).toISOString().split('T')[0] : null;

    return res.status(200).json({
      generated: new Date().toISOString(),
      event: {
        name: BLUE_CONFIG.eventName,
        date: BLUE_CONFIG.eventDate,
        daysUntil: days
      },
      capacity: {
        total: BLUE_CONFIG.totalSeats,
        ga: BLUE_CONFIG.gaSeats,
        vip: BLUE_CONFIG.vipSeats
      },
      sold: {
        total: tickets.total,
        ga: tickets.ga,
        vip: tickets.vip,
        revenue: tickets.revenue
      },
      remaining: {
        total: seatsRemaining,
        ga: BLUE_CONFIG.gaSeats - tickets.ga,
        vip: BLUE_CONFIG.vipSeats - tickets.vip
      },
      pace: {
        runRateNeeded: Math.round(runRateNeeded * 100) / 100,
        last7DaysVelocity: Math.round(last7Velocity * 100) / 100,
        daysToFillAtCurrentPace: daysToFill,
        projectedFillDate,
        onTrackToFill: daysToFill !== null && daysToFill <= days
      },
      windows: {
        today: {
          tickets: todayTickets.length,
          revenue: todayTickets.reduce((s, c) => s + c.amount, 0) / 100,
          totalCharges: today.charges.length,
          totalRevenue: today.revenue
        },
        last7Days: {
          tickets: weekTickets.length,
          revenue: weekTickets.reduce((s, c) => s + c.amount, 0) / 100,
          totalCharges: week.charges.length,
          totalRevenue: week.revenue
        },
        last30Days: {
          tickets: last30Tickets.length,
          revenue: last30Tickets.reduce((s, c) => s + c.amount, 0) / 100,
          totalCharges: last30.charges.length,
          totalRevenue: last30.revenue
        }
      },
      recentSales
    });

  } catch (err) {
    console.error('[admin/dashboard] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
