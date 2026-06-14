/**
 * Daily Health Check for the in-app Feedback pipeline.
 *
 * Star June 14 2026: "How do we make sure the feedback comes to me?
 * You need to build a health thing to make sure that feedback is
 * coming to me."
 *
 * The risk: testers tap "Send feedback to Star" inside the Audacity
 * app, the request hits the Supabase Edge Function `send-feedback`,
 * which then calls Resend to email Star. If ANY link in that chain
 * silently breaks (Edge Function un-deployed, RESEND_API_KEY revoked,
 * Resend domain mis-verified, Supabase down), Star never hears about
 * it until a tester complains weeks later.
 *
 * This cron pokes the Edge Function once a day with a recognizable
 * health-check payload. The function validates env, parses, returns
 * 200 — but DOES NOT send a real email (so Star isn't spammed daily).
 *
 *   - If the Edge Function responds 200: silence. All is well.
 *   - If anything fails: Star gets an alert email naming what broke.
 *
 * Runs at 14:00 UTC daily (one hour after the website form health
 * check, to spread load). Configured in vercel.json.
 *
 * Required env on Vercel:
 *   - SUPABASE_URL                (e.g. https://ralmodzgkcaqkvliryne.supabase.co)
 *   - SUPABASE_ANON_KEY           (for Authorization: Bearer)
 *   - RESEND_API_KEY              (to alert Star on failure)
 */

const HEALTH_MARKER = 'health-check-daily';
const TIMEOUT_MS = 12000;
const RETRY_BACKOFFS = [0, 30000, 60000];

async function attemptOnce(url, anonKey) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'X-Health-Check': HEALTH_MARKER
      },
      body: JSON.stringify({ health_check: HEALTH_MARKER }),
      signal: controller.signal
    });
    let body = '';
    try { body = await res.text(); } catch (_) {}
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      body: body.slice(0, 240)
    };
  } catch (err) {
    return {
      ok: false,
      status: 'fetch-error',
      durationMs: Date.now() - started,
      body: String(err && err.message ? err.message : err)
    };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function checkWithRetries(url, anonKey) {
  let last = null;
  for (let i = 0; i < RETRY_BACKOFFS.length; i++) {
    if (RETRY_BACKOFFS[i] > 0) await sleep(RETRY_BACKOFFS[i]);
    last = await attemptOnce(url, anonKey);
    if (last.ok) {
      return i > 0 ? { ...last, recoveredAfterRetries: i } : last;
    }
  }
  return { ...last, retried: true };
}

async function alertStar(result, edgeUrl) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('RESEND_API_KEY missing — cannot alert Star about feedback pipeline failure');
    return;
  }

  const subject = `[Audacity] In-app feedback pipeline FAILED`;
  const text = [
    '*** AUDACITY IN-APP FEEDBACK PIPELINE FAILED ***',
    '',
    'Testers tapping "Send feedback to Star" inside the app right now',
    'may not be reaching you. The daily health check could not get a',
    'successful response from the Supabase Edge Function.',
    '',
    `Edge Function URL: ${edgeUrl}`,
    `Response status:   ${result.status}`,
    `Duration:          ${result.durationMs}ms`,
    `Retried:           ${result.retried ? 'yes (3 attempts over 90s)' : 'no'}`,
    `Body:              ${result.body || '(empty)'}`,
    '',
    'Checked at: ' + new Date().toISOString(),
    '',
    'Next steps:',
    '1. Check Supabase Edge Function logs:',
    '   supabase functions logs send-feedback',
    '2. Confirm RESEND_API_KEY is set on the function:',
    '   supabase secrets list',
    '3. Re-deploy if needed:',
    '   supabase functions deploy send-feedback',
    '4. Manually trigger this check to re-test:',
    '   POST https://starjessetaylor.com/api/feedback-health-check?token=<HEALTH_CHECK_TRIGGER_TOKEN>'
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Audacity Health <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject,
        text
      })
    });
  } catch (e) {
    console.error('Failed to alert Star about feedback pipeline failure:', e);
  }
}

module.exports = async (req, res) => {
  // Allow manual triggering via GET (with a token) for debugging without
  // having to wait for the cron, but keep the default POST path open for
  // Vercel's cron runner.
  const isCron = req.headers['user-agent']?.includes('vercel-cron');
  const triggerToken = process.env.HEALTH_CHECK_TRIGGER_TOKEN;
  const providedToken = req.query?.token || '';

  if (!isCron && triggerToken && providedToken !== triggerToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
    return res.status(500).json({
      ok: false,
      error: 'Missing Supabase env vars on Vercel'
    });
  }

  const edgeUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-feedback`;
  const result = await checkWithRetries(edgeUrl, anonKey);

  if (!result.ok) {
    await alertStar(result, edgeUrl);
  }

  return res.status(200).json({
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
    retried: result.retried || false,
    recoveredAfterRetries: result.recoveredAfterRetries
  });
};
