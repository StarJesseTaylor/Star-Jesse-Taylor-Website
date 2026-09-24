// WHO GOT WHAT, AND WHEN — /api/admin/sms-log?key=CRON_SECRET
//
// WHY THIS EXISTS
// ---------------
// Star, 23 Sep: "Can you also keep track of when we send them out?" and "How
// can we keep track of that?"
//
// Until now the only way to answer that was to ask me, and I would open the
// database and read it out. That is a terrible way to run something that texts
// real people every day: he cannot check it at 11pm, he cannot check it while
// I am not here, and every answer arrives filtered through me. Which matters
// more than usual, given that the last three things I told him were working
// were not.
//
// So this is the log, in his own words, in a browser, on his phone. No SQL, no
// console, no waiting. It reads and shows. It cannot send anything, change
// anything or delete anything.
//
// Times are shown in THEIR timezone, because "when did Mel get hers" means
// Mel's afternoon, not Star's. This engine has confused those twice already.

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sbFetch(path) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Promise.resolve(null);
  return fetch(url + '/rest/v1/' + path, {
    headers: { apikey: key, Authorization: 'Bearer ' + key },
  }).catch(() => null);
}

/** Format an instant in someone else's day. */
function localTime(iso, tz) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'UTC', weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected || (req.query && req.query.key) !== expected) {
    return res.status(401).send('Unauthorized. Add ?key=YOUR_CRON_SECRET to the URL.');
  }

  const [mRes, lRes, sRes] = await Promise.all([
    sbFetch('member_channel?select=id,first_name,phone,timezone,status,consent_at&order=first_name'),
    sbFetch('message_log?select=member_id,body,status,provider_sid,line_id,created_at,meta,direction&direction=eq.outbound&order=created_at.desc&limit=300'),
    sbFetch('message_schedule?select=member_id,local_date,send_at_utc,sent_at,line_id&order=send_at_utc.desc&limit=200'),
  ]);

  if (!mRes || !mRes.ok) return res.status(502).send('Could not read the database.');

  const members = await mRes.json().catch(() => []);
  const logs = lRes && lRes.ok ? await lRes.json().catch(() => []) : [];
  const slots = sRes && sRes.ok ? await sRes.json().catch(() => []) : [];
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));

  // A text that actually reached a phone has a Twilio receipt. Everything else
  // is an attempt, however hopeful its status column looks. This distinction is
  // the one the send cap got wrong for two days, so it is drawn once, here.
  const landed = (r) => !!r.provider_sid;

  const now = Date.now();
  const rows = members.map((m) => {
    const mine = logs.filter((l) => l.member_id === m.id);
    const real = mine.filter(landed);
    const last = real[0];
    const nextSlot = slots
      .filter((s) => s.member_id === m.id && !s.sent_at && new Date(s.send_at_utc).getTime() > now - 20 * 60_000)
      .sort((a, b) => new Date(a.send_at_utc) - new Date(b.send_at_utc))[0];
    const failsToday = mine.filter(
      (l) => !landed(l) && now - new Date(l.created_at).getTime() < 24 * 3600_000
    ).length;
    return { m, real, last, nextSlot, failsToday };
  });

  const card = (r) => {
    const { m, real, last, nextSlot, failsToday } = r;
    const silentDays = last ? Math.floor((now - new Date(last.created_at).getTime()) / 86400_000) : null;
    const state =
      m.status !== 'active' ? ['stopped', '#b45309']
      : !last ? ['never received one', '#b91c1c']
      : silentDays >= 2 ? ['nothing for ' + silentDays + ' days', '#b91c1c']
      : ['ok', '#15803d'];

    return (
      '<section class="card">' +
      '<h2>' + esc(m.first_name || '(no name)') +
      ' <span class="pill" style="background:' + state[1] + '">' + esc(state[0]) + '</span></h2>' +
      '<p class="meta">' + esc(m.timezone || 'no timezone') +
      ' &middot; their time now ' + esc(localTime(new Date().toISOString(), m.timezone)) +
      ' &middot; ' + real.length + ' text' + (real.length === 1 ? '' : 's') + ' all time' +
      (failsToday ? ' &middot; <strong style="color:#b91c1c">' + failsToday + ' failed attempts today</strong>' : '') +
      '</p>' +
      (nextSlot
        ? '<p class="next">Next: <strong>' + esc(localTime(nextSlot.send_at_utc, m.timezone)) + '</strong> their time</p>'
        : '<p class="next dim">No text scheduled yet. It gets rolled at the start of their day.</p>') +
      (real.length
        ? '<ul>' + real.slice(0, 6).map((l) =>
            '<li><span class="when">' + esc(localTime(l.created_at, m.timezone)) + '</span>' +
            '<span class="body">' + esc(l.body || '(no text recorded)') + '</span></li>').join('') + '</ul>'
        : '<p class="dim">Nothing has ever reached this phone.</p>') +
      '</section>'
    );
  };

  // Failures get their own section. They are the thing worth looking at, and
  // burying them under the successes is how Hana went two days unnoticed.
  const failures = logs
    .filter((l) => !landed(l) && l.meta && l.meta.error)
    .slice(0, 12)
    .map((l) =>
      '<li><span class="when">' + esc(localTime(l.created_at, (byId[l.member_id] || {}).timezone)) + '</span>' +
      '<strong>' + esc((byId[l.member_id] || {}).first_name || 'unknown') + '</strong> ' +
      '<span class="err">' + esc(String(l.meta.error).slice(0, 160)) + '</span></li>')
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Reminder log</title>' +
    '<style>' +
    ':root{color-scheme:light dark}' +
    'body{font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:22px 16px 60px;max-width:760px;margin-inline:auto;background:#fff;color:#111}' +
    '@media(prefers-color-scheme:dark){body{background:#0f1115;color:#e7e9ee}.card{background:#171a21;border-color:#2a2f3a}}' +
    'h1{font-size:23px;margin:0 0 4px}' +
    '.sub{color:#6b7280;margin:0 0 22px;font-size:14px}' +
    '.card{border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:0 0 14px;background:#fafafa}' +
    'h2{font-size:17px;margin:0 0 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.pill{font-size:11px;font-weight:600;color:#fff;padding:2px 8px;border-radius:20px;letter-spacing:.02em}' +
    '.meta{color:#6b7280;font-size:13px;margin:0 0 8px}' +
    '.next{margin:0 0 10px;font-size:14px}' +
    '.dim{color:#9ca3af}' +
    'ul{list-style:none;padding:0;margin:0}' +
    'li{display:flex;gap:10px;padding:7px 0;border-top:1px solid #e5e7eb33;font-size:14px;align-items:baseline}' +
    '.when{flex:0 0 118px;color:#6b7280;font-size:12.5px}' +
    '.body{flex:1}' +
    '.err{color:#b91c1c}' +
    '</style>' +
    '<h1>Reminder log</h1>' +
    '<p class="sub">Every text that actually reached a phone, newest first, shown in each person&rsquo;s own time. ' +
    'Refresh whenever. Nothing here can send or change anything.</p>' +
    rows.map(card).join('') +
    (failures
      ? '<section class="card"><h2>Recent failures</h2><ul>' + failures + '</ul></section>'
      : '<section class="card"><h2>Recent failures</h2><p class="dim">None.</p></section>')
  );
}
