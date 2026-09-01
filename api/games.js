/**
 * Audacity Games board API — starjessetaylor.com/games
 *
 * Shared 30-day valued-action board. One row per member in Supabase
 * (games_progress). The member NAME LIST lives in games.html; this only
 * stores progress + the claim token.
 *
 * claim-your-row: first device to tap a name sets owner_token. After that,
 * only requests carrying that token may edit that row. owner_token is NEVER
 * returned to the client (only a boolean "claimed").
 *
 * GET  /api/games                      -> { members: [{name, days, claimed}] }
 * POST /api/games { op:'claim', member, token }
 * POST /api/games { op:'log', member, day, actions:[...], token }
 * POST /api/games { op:'reset', key:CRON_SECRET }   -> wipe all (Sept 1 fresh start)
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 */

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REST = () => `${SUPABASE_URL}/rest/v1/games_progress`;

function sb(headers = {}) {
  return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json', ...headers };
}

// The row is owned by whoever knows its PIN, not by a device. We store only a
// salted hash of the PIN (member name as salt) so the raw PIN is never at rest.
// This lets a member log in from ANY device with their PIN, and stops someone
// else from grabbing their row by accident.
function pinHash(member, pin) {
  return crypto.createHash('sha256').update(`${member}::${pin}`).digest('hex');
}

const GARDEN_KEYS = ['fit', 'art', 'content', 'biz', 'connect', 'meditate', 'relationship', 'relax', 'nature', 'wins', 'any'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('games: missing supabase env', !!SUPABASE_URL, !!SERVICE_KEY);
    return res.status(500).json({ error: 'not configured' });
  }

  // ---- GET: whole board (no tokens leaked) ----
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${REST()}?select=member_name,days,pin_hash`, { headers: sb() });
      if (!r.ok) return res.status(502).json({ error: 'read failed' });
      const rows = await r.json();
      const members = (rows || []).map((row) => ({
        name: row.member_name,
        days: row.days || {},
        claimed: !!row.pin_hash,
      }));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ members });
    } catch (err) {
      console.error('games GET error', err);
      return res.status(500).json({ error: 'read error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = req.body || {};
  const op = body.op;

  // ---- reset (admin) ----
  if (op === 'reset') {
    if (!process.env.CRON_SECRET || body.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    try {
      // delete every row: filter member_name not equal to an impossible value
      const r = await fetch(`${REST()}?member_name=neq.__none__`, { method: 'DELETE', headers: sb({ Prefer: 'return=minimal' }) });
      if (!r.ok) return res.status(502).json({ error: 'reset failed', detail: await r.text().catch(() => '') });
      return res.status(200).json({ ok: true, reset: true });
    } catch (err) {
      console.error('games reset error', err);
      return res.status(500).json({ error: 'reset error' });
    }
  }

  const member = typeof body.member === 'string' ? body.member.slice(0, 120) : '';
  const pin = typeof body.pin === 'string' ? body.pin.trim().slice(0, 12) : '';
  if (!member || !pin) return res.status(400).json({ error: 'member and pin required' });
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'pin must be 4 to 8 digits' });
  const ph = pinHash(member, pin);

  async function getRow() {
    const r = await fetch(`${REST()}?member_name=eq.${encodeURIComponent(member)}&select=member_name,pin_hash,days`, { headers: sb() });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows && rows[0]) || null;
  }

  // ---- claim ----
  if (op === 'claim') {
    try {
      const row = await getRow();
      // Row already has a PIN: it must match (this is a login from any device).
      if (row && row.pin_hash && row.pin_hash !== ph) {
        return res.status(409).json({ error: 'wrong_pin' });
      }
      // First claim sets the PIN. A matching-PIN login just refreshes the row.
      const payload = { member_name: member, updated_at: new Date().toISOString() };
      if (!row || !row.pin_hash) payload.pin_hash = ph;
      const r = await fetch(REST(), {
        method: 'POST',
        headers: sb({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(payload),
      });
      if (!r.ok) return res.status(502).json({ error: 'claim failed', detail: await r.text().catch(() => '') });
      return res.status(200).json({ ok: true, claimed: true });
    } catch (err) {
      console.error('games claim error', err);
      return res.status(500).json({ error: 'claim error' });
    }
  }

  // ---- log a day's actions ----
  if (op === 'log') {
    const day = parseInt(body.day, 10);
    if (!(day >= 1 && day <= 30)) return res.status(400).json({ error: 'bad day' });
    let actions = Array.isArray(body.actions) ? body.actions : [];
    actions = actions.filter((k) => GARDEN_KEYS.includes(k)).slice(0, 10);
    try {
      const row = await getRow();
      if (!row || !row.pin_hash) return res.status(403).json({ error: 'claim your row first' });
      if (row.pin_hash !== ph) return res.status(403).json({ error: 'wrong pin' });
      const days = row.days || {};
      if (actions.length) days[String(day)] = actions;
      else delete days[String(day)];
      const r = await fetch(`${REST()}?member_name=eq.${encodeURIComponent(member)}`, {
        method: 'PATCH',
        headers: sb({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ days, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return res.status(502).json({ error: 'log failed', detail: await r.text().catch(() => '') });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('games log error', err);
      return res.status(500).json({ error: 'log error' });
    }
  }

  // ---- set a day's plan (action + time), stored in days.plan[day] ----
  if (op === 'setplan') {
    const day = parseInt(body.day, 10);
    if (!(day >= 0 && day <= 30)) return res.status(400).json({ error: 'bad day' }); // day 0 = the morning anchor
    let items;
    if (Array.isArray(body.items)) {
      items = body.items.map((it) => ({ a: String((it && it.a) || '').slice(0, 300), t: String((it && it.t) || '').slice(0, 40), done: !!(it && it.done) }))
        .filter((it) => it.a || it.t).slice(0, 12);
    } else {
      const a = (typeof body.action === 'string' ? body.action : '').slice(0, 300);
      const t = (typeof body.time === 'string' ? body.time : '').slice(0, 40);
      items = (a || t) ? [{ a, t }] : [];
    }
    try {
      const row = await getRow();
      if (!row || !row.pin_hash) return res.status(403).json({ error: 'claim your row first' });
      if (row.pin_hash !== ph) return res.status(403).json({ error: 'wrong pin' });
      const days = row.days || {};
      if (!days.plan) days.plan = {};
      if (items.length) days.plan[String(day)] = items;
      else delete days.plan[String(day)];
      const r = await fetch(`${REST()}?member_name=eq.${encodeURIComponent(member)}`, {
        method: 'PATCH', headers: sb({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ days, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return res.status(502).json({ error: 'setplan failed', detail: await r.text().catch(() => '') });
      return res.status(200).json({ ok: true });
    } catch (err) { console.error('games setplan error', err); return res.status(500).json({ error: 'setplan error' }); }
  }

  // ---- set main garden (stored in days.main, ignored by score/streak) ----
  if (op === 'setmain') {
    const garden = typeof body.garden === 'string' ? body.garden : '';
    try {
      const row = await getRow();
      if (!row || !row.pin_hash) return res.status(403).json({ error: 'claim your row first' });
      if (row.pin_hash !== ph) return res.status(403).json({ error: 'wrong pin' });
      const days = row.days || {};
      if (GARDEN_KEYS.includes(garden)) days.main = garden; else delete days.main;
      const r = await fetch(`${REST()}?member_name=eq.${encodeURIComponent(member)}`, {
        method: 'PATCH', headers: sb({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ days, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return res.status(502).json({ error: 'setmain failed', detail: await r.text().catch(() => '') });
      return res.status(200).json({ ok: true });
    } catch (err) { console.error('games setmain error', err); return res.status(500).json({ error: 'setmain error' }); }
  }

  return res.status(400).json({ error: 'unknown op' });
}
