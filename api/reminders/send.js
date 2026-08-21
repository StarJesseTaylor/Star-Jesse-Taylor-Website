// THE CRON — rolls each member's day, sends what's due, logs everything.
//
// 🛑 THERE IS NO AI IN THIS FILE. That is the whole design.
//    The member receives one of Star's 30 VERBATIM lines with blanks filled.
//    Nothing is generated, so nothing can drift, hallucinate, or reassure.
//    It sounds exactly like Star because it IS Star.
//
//    (v1 of this file imported _brain.js and called writeReminder(). It was
//    written 2.5 HOURS BEFORE _lines.js existed and never imported it — so the
//    cron would have called an AI, at a fixed hour, using "themes" that don't
//    exist, and Star's 30 lines would never have been read. [Website] caught it
//    in review. The spec described a build that wasn't wired. Rewritten.)
//
// SAFETY POSTURE — deliberate, do not "simplify" away:
//   • dryRun is the DEFAULT. A live send needs ?live=1 explicitly.
//   • MAX_MEMBERS caps blast radius even if the query goes wrong.
//   • The daily roll is PERSISTED, so retries can't double-send.
//   • status='active' only — leaving the community turns reminders off.
//   • Stale sends are DROPPED and LOGGED, never sent hours late.
//   Why: api/email-writer/send.js sits in this same repo able to mail the whole
//   database while reporting success. That is what happens without guards.

import { rollDay, dueNow, localDate, localToUtc } from './_schedule.js';
import { LINES, pickLine, render } from './_lines.js';
import { normalisePhone, pickChannel, sendMessage } from './_channel.js';

const MAX_MEMBERS = 200;
const STALE_MIN = 20;        // a "surprise" 4h late isn't a surprise, it's a bug
const RECENT_WINDOW = 25;    // how many past lines to avoid repeating

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 🛑 AUTH. Do NOT reintroduce an `x-vercel-cron` check here.
  //    v1 trusted `req.headers['x-vercel-cron'] === '1'` as proof the caller was
  //    Vercel's scheduler. It is an ORDINARY REQUEST HEADER — Vercel does not
  //    strip it from inbound traffic — so anyone could set it and run this
  //    endpoint with no secret at all. Verified against production 2026-08-07:
  //    `curl -H "x-vercel-cron: 1" .../send` returned 200 and a full report.
  //    With members in the table, `?live=1` on that same request would have
  //    texted every one of them, on repeat, from Star's number, billed to Star.
  //
  //    Vercel's real cron sends `Authorization: Bearer $CRON_SECRET` whenever
  //    CRON_SECRET is set in the project. That is a shared secret, so that is
  //    what we trust. The ?key= form stays for manual runs.
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET not configured' });
  const viaBearer = req.headers.authorization === `Bearer ${secret}`;
  const viaQuery = req.query?.key === secret;
  if (!viaBearer && !viaQuery) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── 🔴 THE ARMING SWITCH. This decides whether anything actually leaves. ──
  //
  //    Until now the ONLY way to send for real was ?live=1 on the URL, and the
  //    cron in vercel.json does not carry it. So the schedule has been running
  //    every minute, picking the right people, rendering the right line, and
  //    then throwing it away. The engine has never sent a text on its own.
  //
  //    The fix is NOT to put ?live=1 in vercel.json. A send flag committed to
  //    git is a loaded gun: it arms itself on any deploy, anyone with repo
  //    access changes it, and turning it off means shipping code.
  //
  //    REMINDERS_LIVE lives in the Vercel dashboard instead:
  //      • Star arms it, not a deploy
  //      • Star disarms it in ten seconds, no deploy, no developer
  //      • Nothing goes live just because code got pushed
  //
  //    ?live=1 survives as a manual override for testing a single run. It is
  //    already behind CRON_SECRET, so only Star can fire it.
  //
  //    Turning this on does NOT release a backlog: anything older than
  //    STALE_MIN is dropped and logged, never sent late (see step 3).
  const armed = process.env.REMINDERS_LIVE === '1';
  const forced = req.query?.live === '1';
  const live = armed || forced;
  const dryRun = !live;

  const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const sb = (path, init = {}) =>
    fetch(`${SB_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', ...(init.headers || {}),
      },
    });

  const report = {
    ranAt: new Date().toISOString(), dryRun,
    // How to read this: armed=true means REMINDERS_LIVE is on and the schedule
    // is sending by itself. armed=false + dryRun=false means someone passed
    // ?live=1 by hand for this one run.
    armed, forced,
    considered: 0, rolled: 0, sent: 0,
    notDue: 0, dropped_stale: 0, skipped: [], errors: [], messages: [],
  };

  try {
    // ── 1. WHO. Active, consented, reminders enabled. ──
    const q =
      'member_channel?select=*,message_prefs!inner(*)' +
      '&status=eq.active' +
      '&consent_at=not.is.null' +
      '&message_prefs.type=eq.reminder' +
      '&message_prefs.enabled=eq.true' +
      `&limit=${MAX_MEMBERS}`;
    const listRes = await sb(q);
    if (!listRes.ok) {
      return res.status(500).json({ error: 'member query failed', detail: (await listRes.text()).slice(0, 300) });
    }
    const members = await listRes.json();
    report.considered = members.length;

    for (const m of members) {
      try {
        const prefs = Array.isArray(m.message_prefs) ? m.message_prefs[0] : m.message_prefs;
        const tz = m.timezone;
        if (!tz) { report.skipped.push({ id: m.id, why: 'no timezone' }); continue; }

        const today = localDate(tz);

        // ── 2. ROLL their day once. Persisted, so this is idempotent. ──
        const schedRes = await sb(`message_schedule?member_id=eq.${m.id}&type=eq.reminder&local_date=eq.${today}&select=*`);
        let sched = schedRes.ok ? await schedRes.json() : [];

        if (!sched.length) {
          const picks = rollDay({ ...prefs }, Math.random);
          const rows = picks.map(p => ({
            member_id: m.id, type: 'reminder', local_date: today,
            send_at_utc: localToUtc(today, p.minutes, tz).toISOString(),   // ← DST-safe
            slot: p.slot, sent_at: null, line_id: null,
          }));
          const ins = await sb('message_schedule', {
            method: 'POST',
            headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
            body: JSON.stringify(rows),
          });
          sched = ins.ok ? await ins.json() : rows;
          report.rolled++;
        }

        // ── 3. What's due right now? ──
        const nowMs = Date.now();
        const pending = sched.filter(s => !s.sent_at);
        const due = pending.filter(s => {
          const t = new Date(s.send_at_utc).getTime();
          return nowMs >= t && (nowMs - t) <= STALE_MIN * 60_000;
        });
        const stale = pending.filter(s => nowMs - new Date(s.send_at_utc).getTime() > STALE_MIN * 60_000);

        // Stale is DROPPED — but LOUDLY. A silent zero is only bad because it's invisible.
        for (const s of stale) {
          report.dropped_stale++;
          await sb(`message_schedule?member_id=eq.${m.id}&type=eq.reminder&local_date=eq.${today}&send_at_utc=eq.${encodeURIComponent(s.send_at_utc)}`, {
            method: 'PATCH', body: JSON.stringify({ sent_at: new Date().toISOString(), line_id: -1 }),
          }).catch(() => {});
          await log(sb, m, { status: 'dropped_stale', meta: { was_due: s.send_at_utc } });
        }

        if (!due.length) { report.notDue++; continue; }

        // ── 4. Pick, render, send. ──
        const histRes = await sb(`message_log?member_id=eq.${m.id}&direction=eq.outbound&order=created_at.desc&limit=${RECENT_WINDOW}&select=line_id`);
        const recent = histRes.ok ? (await histRes.json()).map(r => r.line_id).filter(Boolean) : [];

        const phone = normalisePhone(m.phone, m.country_code);
        if (!phone.ok) { report.skipped.push({ id: m.id, why: `bad phone: ${phone.reason}` }); continue; }

        for (const slotRow of due) {
          const line = pickLine({ ...m, ...prefs }, recent, slotRow.slot);
          if (!line) { report.skipped.push({ id: m.id, why: `no eligible line for slot ${slotRow.slot}` }); continue; }

          // {...m, ...prefs} to mirror pickLine above: valued_action lives on
          // message_prefs, not member_channel, so render(line, m) silently left
          // #13's {action} unpersonalised. tomorrow_word/timezone stay on m —
          // message_prefs has neither column, so the spread can't clobber them.
          const body = render(line, { ...m, ...prefs });
          const channel = m.channel || pickChannel(phone.e164);
          const slotFilter = `member_id=eq.${m.id}&type=eq.reminder&local_date=eq.${today}&send_at_utc=eq.${encodeURIComponent(slotRow.send_at_utc)}`;

          // ── DEDUPE CLAIM (live only) — the fix for DOUBLE-TEXTING. ──
          //    Vercel can fire the same cron run twice. v1 SENT first and wrote
          //    sent_at AFTER, so a second run saw sent_at still null and sent the
          //    same text again. Now we CLAIM the slot before sending: flip sent_at
          //    null -> now, but ONLY if it is still null. Postgres does that update
          //    atomically per row, so exactly one run can win; the loser gets zero
          //    rows back and skips. Skipped in dry-run so dry-runs stay repeatable
          //    and never mark anything sent.
          if (!dryRun) {
            const claim = await sb(`message_schedule?${slotFilter}&sent_at=is.null`, {
              method: 'PATCH',
              headers: { Prefer: 'return=representation' },
              body: JSON.stringify({ sent_at: new Date().toISOString(), line_id: line.id }),
            });
            const claimed = claim.ok ? await claim.json().catch(() => []) : [];
            if (!claimed.length) { report.skipped.push({ id: m.id, why: 'slot already claimed — duplicate run avoided' }); continue; }
          }

          const out = await sendMessage({ to: phone.e164, body, channel, dryRun });

          report.messages.push({ member: m.first_name || m.id, at: slotRow.send_at_utc, slot: slotRow.slot, line: line.id, body });

          await log(sb, m, {
            body, channel: out.channel, line_id: line.id,
            status: out.sent ? 'sent' : (out.dryRun ? 'dry_run' : 'error'),
            provider_sid: out.sid || null,
            meta: out.error ? { error: out.error } : null,
          });

          if (out.sent) {
            report.sent++;
            recent.unshift(line.id);
            // sent_at was already stamped by the claim above — nothing more to do.
          } else if (out.error) {
            report.errors.push({ id: m.id, error: out.error });
            // We claimed the slot but the send failed — RELEASE it so the next run
            // can retry, instead of it being stuck "sent" but never actually sent.
            if (!dryRun) {
              await sb(`message_schedule?${slotFilter}`, {
                method: 'PATCH', body: JSON.stringify({ sent_at: null, line_id: null }),
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        report.errors.push({ id: m.id, error: String(e?.message || e).slice(0, 200) });
      }
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('reminder cron error:', err);
    return res.status(500).json({ error: 'run failed', detail: String(err?.message || err).slice(0, 300) });
  }
}

async function log(sb, member, row) {
  await sb('message_log', {
    method: 'POST',
    body: JSON.stringify({ member_id: member.id, type: 'reminder', direction: 'outbound', ...row }),
  }).catch(() => {});
}
