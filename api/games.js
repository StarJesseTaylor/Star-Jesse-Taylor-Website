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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REST = () => `${SUPABASE_URL}/rest/v1/games_progress`;

function sb(headers = {}) {
  return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json', ...headers };
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
      const r = await fetch(`${REST()}?select=member_name,days,owner_token`, { headers: sb() });
      if (!r.ok) return res.status(502).json({ error: 'read failed' });
      const rows = await r.json();
      const members = (rows || []).map((row) => ({
        name: row.member_name,
        days: row.days || {},
        claimed: !!row.owner_token,
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
  const token = typeof body.token === 'string' ? body.token.slice(0, 80) : '';
  if (!member || !token) return res.status(400).json({ error: 'member and token required' });

  async function getRow() {
    const r = await fetch(`${REST()}?member_name=eq.${encodeURIComponent(member)}&select=member_name,owner_token,days`, { headers: sb() });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows && rows[0]) || null;
  }

  // ---- claim ----
  if (op === 'claim') {
    try {
      const row = await getRow();
      if (row && row.owner_token && row.owner_token !== token) {
        return res.status(409).json({ error: 'already_claimed' });
      }
      // upsert with token
      const r = await fetch(REST(), {
        method: 'POST',
        headers: sb({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ member_name: member, owner_token: token, updated_at: new Date().toISOString() }),
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
      if (!row || !row.owner_token) return res.status(403).json({ error: 'claim your row first' });
      if (row.owner_token !== token) return res.status(403).json({ error: 'not your row' });
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
    const action = (typeof body.action === 'string' ? body.action : '').slice(0, 300);
    const time = (typeof body.time === 'string' ? body.time : '').slice(0, 40);
    try {
      const row = await getRow();
      if (!row || !row.owner_token) return res.status(403).json({ error: 'claim your row first' });
      if (row.owner_token !== token) return res.status(403).json({ error: 'not your row' });
      const days = row.days || {};
      if (!days.plan) days.plan = {};
      if (action || time) days.plan[String(day)] = { a: action, t: time };
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
      if (!row || !row.owner_token) return res.status(403).json({ error: 'claim your row first' });
      if (row.owner_token !== token) return res.status(403).json({ error: 'not your row' });
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
