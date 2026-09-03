// SMS READINESS — /api/admin/sms-readiness?key=CRON_SECRET
//
// WHY THIS EXISTS
// ---------------
// For weeks the answer to "is the texting ready?" was "I can't log into Twilio,
// so I don't know." That is a useless answer to give someone repeatedly.
//
// This page asks Twilio and Supabase directly, using the credentials already
// sitting in Vercel, and reports back in plain English. Star never logs in,
// and no secret is ever printed — only whether it is present and what it says.
//
// Open it in a browser. Green means done. Red means it is the thing blocking you.

const ok = (label, detail) => ({ state: 'ok', label, detail });
const bad = (label, detail) => ({ state: 'bad', label, detail });
const warn = (label, detail) => ({ state: 'warn', label, detail });

const TW_SID = () => process.env.TWILIO_ACCOUNT_SID;
const TW_TOKEN = () => process.env.TWILIO_AUTH_TOKEN;

/** Call the Twilio REST API. Never throws — returns {ok, data, error}. */
async function twilio(url) {
  const sid = TW_SID(), token = TW_TOKEN();
  if (!sid || !token) return { ok: false, error: 'no credentials' };
  try {
    const r = await fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64') },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: 'Twilio ' + r.status + ': ' + (data && data.message ? data.message : 'unknown') };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 200) };
  }
}

/** Count rows in Supabase without pulling them. */
async function supabaseCount(path) {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: 'no credentials' };
  try {
    const r = await fetch(url + '/rest/v1/' + path, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact', Range: '0-0' },
    });
    if (!r.ok) return { ok: false, error: 'Supabase ' + r.status };
    const cr = r.headers.get('content-range') || '';   // "0-0/123"
    return { ok: true, count: Number(cr.split('/')[1] || 0) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 200) };
  }
}

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected || (req.query && req.query.key) !== expected) {
    return res.status(401).json({ error: 'Unauthorized. Add ?key=YOUR_CRON_SECRET to the URL.' });
  }

  const checks = [];
  const sid = TW_SID();

  /* ── 1. CREDENTIALS ── */
  checks.push(
    sid && TW_TOKEN()
      ? ok('Twilio account connected', 'Username and password are set in Vercel.')
      : bad('Twilio account NOT connected', 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are missing from Vercel.')
  );

  /* ── 2. THE PHONE NUMBER ── */
  let ownedNumbers = [];
  const configured = process.env.TWILIO_FROM_NUMBER;
  if (sid) {
    const r = await twilio('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/IncomingPhoneNumbers.json?PageSize=20');
    if (r.ok) {
      ownedNumbers = (r.data && r.data.incoming_phone_numbers) || [];
      const list = ownedNumbers.map(n => n.phone_number).join(', ');
      if (!ownedNumbers.length) {
        checks.push(bad('No phone number owned', 'No number has been bought on this Twilio account yet.'));
      } else if (!configured) {
        checks.push(warn(
          ownedNumbers.length + ' number(s) owned, but none selected',
          'Twilio has ' + list + '. Set TWILIO_FROM_NUMBER in Vercel to the one you want to text from.'
        ));
      } else if (ownedNumbers.some(n => n.phone_number === configured)) {
        checks.push(ok('Phone number ready', 'Texts will come from ' + configured + '.'));
      } else {
        checks.push(bad(
          'The configured number is not on this account',
          'TWILIO_FROM_NUMBER is set to ' + configured + ', but this account owns ' + list + '.'
        ));
      }
    } else {
      checks.push(bad('Could not read your phone numbers', r.error));
    }
  }

  /* ── 3. A2P 10DLC BRAND (US registration, step 1 of 2) ── */
  const brandRes = await twilio('https://messaging.twilio.com/v1/a2p/BrandRegistrations?PageSize=20');
  if (brandRes.ok) {
    const brands = (brandRes.data && (brandRes.data.data || brandRes.data.brand_registrations)) || [];
    if (!brands.length) {
      checks.push(bad('A2P brand not registered', 'US carriers require a registered business before they will carry these texts. Nothing has been filed.'));
    } else {
      const b = brands[0];
      const s = String(b.status || '').toUpperCase();
      const detail = 'Status: ' + b.status + (b.failure_reason ? ' — ' + b.failure_reason : '');
      if (s === 'APPROVED' || s === 'VERIFIED') checks.push(ok('A2P brand approved', detail));
      else if (s === 'FAILED' || s === 'REJECTED') checks.push(bad('A2P brand REJECTED', detail + '. This must be fixed and refiled.'));
      else checks.push(warn('A2P brand still pending', detail + '. Nothing to do but wait.'));
    }
  } else {
    checks.push(warn('Could not read the A2P brand', brandRes.error));
  }

  /* ── 4. THE MESSAGING SERVICE + ITS CAMPAIGN (step 2 of 2) ──
        This is the check that matters most. Without an APPROVED campaign,
        US carriers silently throw the messages away — error 30034 / 30007 —
        and our own send log still cheerfully says "sent". */
  const svcRes = await twilio('https://messaging.twilio.com/v1/Services?PageSize=20');
  if (svcRes.ok) {
    const services = (svcRes.data && svcRes.data.services) || [];
    if (!services.length) {
      checks.push(bad('No Messaging Service', 'The A2P campaign attaches to a Messaging Service. None exists on this account.'));
    } else {
      let foundApproved = false;
      for (const svc of services) {
        const c = await twilio('https://messaging.twilio.com/v1/Services/' + svc.sid + '/Compliance/Usa2p');
        if (!c.ok) {
          checks.push(warn('Messaging Service "' + svc.friendly_name + '" has no campaign', 'No US A2P campaign is attached to this service.'));
          continue;
        }
        const raw = c.data && c.data.compliance ? c.data.compliance : c.data;
        for (const camp of [].concat(raw).filter(Boolean)) {
          const s = String(camp.campaign_status || camp.status || '').toUpperCase();
          const errs = camp.errors && camp.errors.length ? ' — ' + JSON.stringify(camp.errors).slice(0, 200) : '';
          const detail = 'Service "' + svc.friendly_name + '" — campaign status: ' + (camp.campaign_status || camp.status || 'unknown') + errs;
          if (s === 'VERIFIED' || s === 'APPROVED') {
            foundApproved = true;
            checks.push(ok('A2P campaign APPROVED', detail + '. US carriers will carry your texts.'));
          } else if (s === 'FAILED' || s === 'REJECTED') {
            checks.push(bad('A2P campaign REJECTED', detail + '. Texts to US numbers will be thrown away by carriers until this is fixed.'));
          } else {
            checks.push(warn('A2P campaign still pending', detail + '. Do not go live to US members until this says approved.'));
          }
        }
      }
      if (!foundApproved) {
        checks.push(warn(
          'No approved US campaign found',
          'Australian and other non-US numbers are unaffected — A2P is a US-only requirement. US members should wait.'
        ));
      }
    }
  } else {
    checks.push(warn('Could not read Messaging Services', svcRes.error));
  }

  /* ── 5. THE REPLY WEBHOOK ──
        If this is not pointed at us, a member replying gets silence,
        and we never see their reaction — which is the whole point of a test. */
  const site = (process.env.SITE_URL || 'https://starjessetaylor.com').replace(/\/$/, '');
  const wantInbound = site + '/api/reminders/inbound';
  const numRow = ownedNumbers.find(n => n.phone_number === configured) || ownedNumbers[0];
  if (numRow) {
    const current = numRow.sms_url || '';
    if (current === wantInbound) {
      checks.push(ok('Replies reach us', numRow.phone_number + ' is pointed at ' + wantInbound + '.'));
    } else {
      checks.push(bad(
        'Replies go nowhere',
        numRow.phone_number + ' is currently pointed at "' + (current || '(nothing)') + '". It needs to be ' + wantInbound +
        ' — otherwise when a member texts back, you never see it. Fix: Twilio Console → Phone Numbers → click the number →' +
        ' "A message comes in" → paste that URL → Save.'
      ));
    }
  }

  /* ── 6. THE DATABASE ── */
  const mem = await supabaseCount('member_channel?select=id&status=eq.active&consent_at=not.is.null');
  if (mem.ok) {
    checks.push(mem.count > 0
      ? ok(mem.count + ' member(s) enrolled', 'These are the people who would receive texts once sending is armed.')
      : warn('Nobody is enrolled yet', 'The engine will run and send nothing, because there is no one to send to.'));
  } else {
    checks.push(bad('Database not reachable', mem.error));
  }

  /* ── 7. THE TWO SWITCHES ── */
  const live = process.env.REMINDERS_LIVE === '1';
  const signupOpen = process.env.REMINDERS_SIGNUP_OPEN === '1';
  checks.push(live
    ? warn('SENDING IS LIVE', 'Real texts are going out on the schedule right now.')
    : ok('Sending is OFF (safe)', 'Set REMINDERS_LIVE=1 in Vercel when you want texts to actually go out.'));
  checks.push(signupOpen
    ? warn('Signup is OPEN', 'Anyone ticking the box on /sms is being enrolled.')
    : ok('Signup is CLOSED (safe)', 'Set REMINDERS_SIGNUP_OPEN=1 in Vercel when you want the public door open.'));

  /* ── VERDICT ── */
  const blockers = checks.filter(c => c.state === 'bad');
  const verdict = blockers.length === 0
    ? 'Everything Twilio needs is in place. What is left is your call, not a technical blocker.'
    : blockers.length + ' thing(s) are blocking you. They are marked in red below.';

  if (String((req.query && req.query.format) || '').toLowerCase() === 'json') {
    return res.status(200).json({ verdict, blockers: blockers.length, checks });
  }

  const colour = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626' };
  const word = { ok: 'READY', warn: 'CHECK', bad: 'BLOCKED' };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = checks.map(c =>
    '<div class="row"><div class="tag" style="color:' + colour[c.state] + '">' + word[c.state] + '</div>' +
    '<div><div class="label">' + esc(c.label) + '</div><div class="detail">' + esc(c.detail) + '</div></div></div>'
  ).join('');

  const html = [
    '<!doctype html><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>SMS readiness</title>',
    '<style>',
    'body{font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    'max-width:760px;margin:0 auto;padding:28px 20px 80px;color:#111;background:#fff}',
    'h1{font-size:24px;margin:0 0 4px}.sub{color:#666;font-size:14px;margin-bottom:24px}',
    '.verdict{padding:14px 16px;border-radius:10px;margin-bottom:26px;font-weight:600;',
    'background:' + (blockers.length ? '#fef2f2' : '#f0fdf4') + ';color:' + (blockers.length ? '#991b1b' : '#166534') + '}',
    '.row{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #eee;align-items:flex-start}',
    '.tag{flex:0 0 76px;font-size:11px;font-weight:700;letter-spacing:.04em;padding-top:2px}',
    '.label{font-weight:600;margin-bottom:3px}.detail{color:#555;font-size:14px;word-break:break-word}',
    '@media(prefers-color-scheme:dark){body{background:#0b0b0c;color:#eee}.row{border-color:#222}.detail{color:#aaa}}',
    '</style>',
    '<h1>SMS readiness</h1>',
    '<div class="sub">Asked Twilio and the database directly, just now.</div>',
    '<div class="verdict">' + esc(verdict) + '</div>',
    rows,
  ].join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}
