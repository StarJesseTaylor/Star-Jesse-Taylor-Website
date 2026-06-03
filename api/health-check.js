/**
 * Daily Health Check for all submission endpoints.
 *
 * Runs once per day via Vercel cron. Hits every form-backing API
 * endpoint with a marker payload that the endpoint can recognize and
 * skip ActiveCampaign tagging for. If ANY endpoint fails (non-2xx
 * response, fetch error, etc.), emails Star at starjessetaylor@gmail.com
 * with the broken endpoint list. If all endpoints respond OK, sends
 * nothing — silence is success.
 *
 * The marker email used in every test payload is
 *   health-check+<timestamp>@noreply.starjessetaylor.com
 * so any payload that hits AC by accident is easy to filter out.
 *
 * Built June 3, 2026 after the apply.html form was found to have been
 * silently failing for an unknown period. Goal: never again be
 * unaware of a broken form for more than 24 hours.
 *
 * Scheduling: configured in vercel.json with a daily cron at 13:00 UTC
 * (6 AM Pacific).
 */

const HEALTH_MARKER = 'health-check-daily';

function markerEmail() {
  const ts = Date.now();
  return `health-check+${ts}@noreply.starjessetaylor.com`;
}

function commonHealthHeader() {
  return { 'Content-Type': 'application/json', 'X-Health-Check': HEALTH_MARKER };
}

const ENDPOINTS = [
  {
    name: 'coaching-application',
    path: '/api/coaching-application',
    payload: () => ({
      full_name: 'Health Check Bot',
      email: markerEmail(),
      main_challenge: 'Daily health check submission.',
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'event-waitlist',
    path: '/api/event-waitlist',
    payload: () => ({
      name: 'Health',
      lastName: 'Check',
      email: markerEmail(),
      country: 'USA',
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'la-meetup-waitlist',
    path: '/api/la-meetup-waitlist',
    payload: () => ({
      firstName: 'Health',
      lastName: 'Check',
      email: markerEmail(),
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'cohort-waitlist',
    path: '/api/cohort-waitlist',
    payload: () => ({
      name: 'Health',
      lastName: 'Check',
      email: markerEmail(),
      country: 'USA',
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'workshop-questionnaire',
    path: '/api/workshop-questionnaire',
    payload: () => ({
      firstName: 'Health Check',
      email: markerEmail(),
      walkAway: 'Daily health check submission.',
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'speaking-inquiry',
    path: '/api/speaking-inquiry',
    payload: () => ({
      firstName: 'Health',
      lastName: 'Check',
      email: markerEmail(),
      message: 'Daily health check submission.',
      health_check: HEALTH_MARKER
    })
  },
  {
    name: 'qualify',
    path: '/api/qualify',
    payload: () => ({
      email: markerEmail(),
      firstName: 'Health Check',
      health_check: HEALTH_MARKER
    })
  }
];

async function checkEndpoint(baseUrl, endpoint) {
  const url = baseUrl + endpoint.path;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: commonHealthHeader(),
      body: JSON.stringify(endpoint.payload())
    });
    const durationMs = Date.now() - started;
    let bodyText = '';
    try { bodyText = await res.text(); } catch (_) {}
    return {
      name: endpoint.name,
      path: endpoint.path,
      ok: res.ok,
      status: res.status,
      durationMs,
      body: bodyText.slice(0, 240)
    };
  } catch (err) {
    return {
      name: endpoint.name,
      path: endpoint.path,
      ok: false,
      status: 'fetch-error',
      durationMs: Date.now() - started,
      body: String(err && err.message ? err.message : err)
    };
  }
}

async function alertStar(failed, allResults) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing — cannot alert Star about failures');
    return;
  }
  const text = [
    '*** WEBSITE FORM HEALTH CHECK FAILED ***',
    '',
    'One or more form endpoints failed the daily health check. People',
    'submitting these forms right now may not be reaching Star.',
    '',
    'Failed endpoints:',
    ...failed.map(r => `  • ${r.name} (${r.path}) — status ${r.status} after ${r.durationMs}ms`),
    '',
    '— Detail for each failure —',
    ...failed.map(r => [
      '',
      `[${r.name}]`,
      `Status: ${r.status}`,
      `Duration: ${r.durationMs}ms`,
      `Body: ${r.body || '(empty)'}`
    ].join('\n')),
    '',
    '— Full results —',
    ...allResults.map(r => `  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(28)} ${r.status}`),
    '',
    `Checked at: ${new Date().toISOString()}`,
    '',
    'Next steps:',
    '1. Open the website in a browser and try to submit the failed form yourself',
    '2. If it fails, check Vercel deployment logs for the endpoint',
    '3. Ask Claude Code to investigate and fix'
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Website Health Check <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: `🚨 Website forms failing: ${failed.map(r => r.name).join(', ')}`,
        text
      })
    });
  } catch (err) {
    console.error('Failed to alert Star about health check failures:', err);
  }
}

async function checkResendService() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 'no-key', body: 'RESEND_API_KEY environment variable missing' };
  }
  const started = Date.now();
  try {
    // GET /domains is a cheap authenticated call that proves Resend
    // accepts the API key and the service is reachable.
    const res = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      body: res.ok ? 'reachable' : (await res.text()).slice(0, 240)
    };
  } catch (err) {
    return {
      ok: false,
      status: 'fetch-error',
      durationMs: Date.now() - started,
      body: String(err && err.message ? err.message : err)
    };
  }
}

async function checkAlertEmailPath() {
  // We send a tiny test email to ourselves with subject prefix [ping].
  // If this fails, the alert system itself is broken and we need to
  // know. The email body is one line so it does not clutter the inbox.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, status: 'no-key', body: 'RESEND_API_KEY missing' };
  const started = Date.now();
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Website Health Check <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: '[ping] Health check alert path test',
        text: 'This confirms the health-check alert email path is functional. Auto-fired by daily cron. You only see this if something else also failed today, or once a week as a heartbeat.'
      })
    });
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      body: res.ok ? 'sent' : (await res.text()).slice(0, 240)
    };
  } catch (err) {
    return {
      ok: false,
      status: 'fetch-error',
      durationMs: Date.now() - started,
      body: String(err && err.message ? err.message : err)
    };
  }
}

async function sendHeartbeat(results) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const lines = [
    '✓ All website forms responded successfully today.',
    '',
    '— Endpoints checked —',
    ...results.map(r => `  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(28)} ${r.status}`),
    '',
    `Checked at: ${new Date().toISOString()}`,
    '',
    'You get this email every day the system passes. If you stop',
    'seeing it for more than a day, the monitor itself has stopped',
    'running. If anything ever fails, you get a different email with',
    'subject "🚨 Website forms failing".'
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Website Health Check <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: '✓ Health check: all forms working',
        text: lines
      })
    });
  } catch (err) {
    console.error('Heartbeat send failed:', err);
  }
}

export default async function handler(req, res) {
  // Allow GET so Vercel cron can hit it without a payload
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const host = req.headers && req.headers.host ? req.headers.host : 'starjessetaylor.com';
  const protocol = host.indexOf('localhost') >= 0 ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // 1. Check each form-backing endpoint
  const results = [];
  for (const endpoint of ENDPOINTS) {
    results.push(await checkEndpoint(baseUrl, endpoint));
  }

  // 2. Check Resend service itself (the email infra everything depends on)
  const resendCheck = await checkResendService();
  results.push({ name: 'resend-service', path: 'api.resend.com/domains', ...resendCheck });

  const failed = results.filter(r => !r.ok);

  // 3. If anything failed, send the alert email. Otherwise send the
  //    daily heartbeat so Star knows the cron is still alive. If he
  //    ever stops seeing the heartbeat for more than a day, the monitor
  //    itself has died and he should investigate.
  if (failed.length > 0) {
    await alertStar(failed, results);
  } else {
    await sendHeartbeat(results);
  }

  return res.status(failed.length > 0 ? 503 : 200).json({
    ok: failed.length === 0,
    checkedAt: new Date().toISOString(),
    results
  });
}
