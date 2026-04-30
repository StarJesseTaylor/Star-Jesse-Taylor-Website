/**
 * Event seats API.
 *
 * Returns the current LA Intensive ticket sales pulled from Stripe.
 * Used by event.html to render a live seat counter with tiered messaging
 * (hidden below 5 sold, "Filling up" 5-14, count display 15-24,
 * "Almost full" 25-29, "Sold out" at 30).
 *
 * Module-level cache lasts 5 minutes per warm function instance to limit
 * Stripe load. Edge Cache-Control header lets Vercel serve repeats from
 * the CDN without invoking the function on every page load.
 */

import { fetchTotalEventTicketSales } from './blue/_lib.js';

const TTL_MS = 5 * 60 * 1000;
const TOTAL_SEATS = 30;
const GA_TOTAL = 22;
const VIP_TOTAL = 8;

let cache = null;
let cacheExpiresAt = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const now = Date.now();
    if (cache && cacheExpiresAt > now) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
      return res.status(200).json(cache);
    }

    const sales = await fetchTotalEventTicketSales();
    const sold = sales.total || 0;
    const remaining = Math.max(0, TOTAL_SEATS - sold);

    cache = {
      sold,
      remaining,
      total: TOTAL_SEATS,
      ga: { sold: sales.ga || 0, total: GA_TOTAL },
      vip: { sold: sales.vip || 0, total: VIP_TOTAL },
      cached_at: new Date().toISOString()
    };
    cacheExpiresAt = now + TTL_MS;

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(cache);
  } catch (err) {
    console.error('[event-seats] error:', err);
    // Safe placeholder on Stripe failure: sold=0 makes the UI hide the counter.
    return res.status(200).json({
      sold: 0,
      remaining: TOTAL_SEATS,
      total: TOTAL_SEATS,
      ga: { sold: 0, total: GA_TOTAL },
      vip: { sold: 0, total: VIP_TOTAL },
      error: 'data_unavailable'
    });
  }
}
