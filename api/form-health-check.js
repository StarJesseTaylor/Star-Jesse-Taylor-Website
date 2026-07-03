/**
 * Form Health Check — daily cron that verifies critical form endpoints are reachable.
 *
 * Star lost a coaching application (Jusab Khamisa) because the form silently failed
 * with no audit trail. Book buyer Aitana temporarily thought her book wasn't delivered.
 * This check catches endpoint-level failures BEFORE they cost more money.
 *
 * For each critical endpoint we:
 *   1. Ping it (GET or lightweight POST)
 *   2. Verify it returns a valid HTTP response (not 502/503/504/500)
 *   3. Compare to expected response
 *   4. If ANY endpoint fails, send Star an URGENT email with details
 *
 * Runs daily at 5 AM PT via vercel.json cron.
 *
 * Env vars:
 *   RESEND_API_KEY — for alerting
 *   STAR_NOTIFY_EMAIL — where to send the alert (defaults to star@starjessetaylor.com)
 *   CRON_SECRET — for optional manual trigger via ?key=...
 *   BOOK_HEALTHCHECK_SESSION_ID — a known-good Stripe session ID for testing /api/book-download
 */

const SITE_URL = 'https://starjessetaylor.com';

// Endpoints to check. Each entry defines the request + what "healthy" looks like.
const CHECKS = [
  {
    name: 'coaching-application',
    method: 'GET',
    url: `${SITE_URL}/api/coaching-application`,
    expectStatus: 405, // GET not allowed - proves endpoint code loaded
    critical: true,
    description: 'Coaching Application form (apply.html)'
  },
  {
    name: 'cohort-waitlist',
    method: 'GET',
    url: `${SITE_URL}/api/cohort-waitlist`,
    expectStatus: 405,
    critical: true,
    description: 'Cohort Waitlist form (cohort.html)'
  },
  {
    name: 'event-waitlist',
    method: 'GET',
    url: `${SITE_URL}/api/event-waitlist`,
    expectStatus: 405,
    critical: true,
    description: 'Event Waitlist form (event.html)'
  },
  {
    name: 'audacity-waitlist',
    method: 'GET',
    url: `${SITE_URL}/api/audacity-waitlist`,
    expectStatus: 405,
    critical: true,
    description: 'App Waitlist form (/app)'
  },
  {
    name: 'audacity-tester-apply',
    method: 'GET',
    url: `${SITE_URL}/api/audacity-tester-apply`,
    expectStatus: 405,
    critical: true,
    description: 'Tester Application form (apply-tester.html)'
  },
  {
    name: 'book-checkout',
    method: 'GET',
    url: `${SITE_URL}/api/book-checkout`,
    expectStatus: 303, // GET should redirect to Stripe
    critical: true,
    description: 'Book Checkout endpoint (creates Stripe session)'
  },
  {
    name: 'book-download-endpoint',
    method: 'GET',
    url: `${SITE_URL}/api/book-download?session_id=cs_test_invalid_health_check`,
    expectStatus: 403, // fake session -> 403 invalid session (endpoint reached)
    critical: true,
    description: 'Book Download endpoint (delivers PDF to buyers)'
  },
  {
    name: 'book-download-real',
    method: 'GET',
    url: `${SITE_URL}/api/book-download?session_id=${encodeURIComponent(process.env.BOOK_HEALTHCHECK_SESSION_ID || 'cs_live_none')}`,
    // With a real known-good session_id set in env, we expect 200 (PDF)
    // Without it, we expect 403 (invalid session)
    expectStatus: process.env.BOOK_HEALTHCHECK_SESSION_ID ? 200 : 403,
    critical: true,
    description: 'Book Download DEEP check (real session_id -> valid PDF)'
  },
  {
    name: 'health-check',
    method: 'GET',
    url: `${SITE_URL}/api/health-check`,
    expectStatus: 200,
    critical: false,
    description: 'Site-level health check'
  },
  // === Expanded coverage added 2026-07-03 (Star asked for health checks on ALL forms) ===
  {
    name: 'free-chapter',
    method: 'GET',
    url: `${SITE_URL}/api/free-chapter`,
    expectStatus: 410,
    critical: false,
    description: 'Free Chapter Download form (RETIRED — returns 410 by design)'
  },
  {
    name: 'join-letter',
    method: 'GET',
    url: `${SITE_URL}/api/join-letter`,
    expectStatus: 405,
    critical: true,
    description: 'Join Letter subscribe form'
  },
  {
    name: 'la-meetup-waitlist',
    method: 'GET',
    url: `${SITE_URL}/api/la-meetup-waitlist`,
    expectStatus: 405,
    critical: true,
    description: 'LA Meetup Waitlist form'
  },
  {
    name: 'qualify',
    method: 'GET',
    url: `${SITE_URL}/api/qualify`,
    expectStatus: 405,
    critical: true,
    description: 'Qualify (cohort/coaching qualifier) form'
  },
  {
    name: 'quiz-submit',
    method: 'GET',
    url: `${SITE_URL}/api/quiz-submit`,
    expectStatus: 405,
    critical: true,
    description: 'Quiz funnel submission (primary funnel entry)'
  },
  {
    name: 'sms-optin',
    method: 'GET',
    url: `${SITE_URL}/api/sms-optin`,
    expectStatus: 405,
    critical: true,
    description: 'SMS opt-in form'
  },
  {
    name: 'speaking-inquiry',
    method: 'GET',
    url: `${SITE_URL}/api/speaking-inquiry`,
    expectStatus: 405,
    critical: true,
    description: 'Speaking Inquiry form'
  },
  {
    name: 'subscribe',
    method: 'GET',
    url: `${SITE_URL}/api/subscribe`,
    expectStatus: 405,
    critical: true,
    description: 'Email subscribe form'
  },
  {
    name: 'tour-interest',
    method: 'GET',
    url: `${SITE_URL}/api/tour-interest`,
    expectStatus: 405,
    critical: true,
    description: 'Tour Interest form (LA #2 / NY / Miami / Austin)'
  },
  {
    name: 'whats-next',
    method: 'GET',
    url: `${SITE_URL}/api/whats-next`,
    expectStatus: 405,
    critical: true,
    description: "What's Next signup form"
  },
  {
    name: 'workshop-questionnaire',
    method: 'GET',
    url: `${SITE_URL}/api/workshop-questionnaire`,
    expectStatus: 405,
    critical: true,
    description: 'Workshop Questionnaire form'
  },
  {
    name: 'zoom-rsvp',
    method: 'GET',
    url: `${SITE_URL}/api/zoom-rsvp`,
    expectStatus: 405,
    critical: true,
    description: 'Zoom RSVP form'
  },
  {
    name: 'event-seats',
    method: 'GET',
    url: `${SITE_URL}/api/event-seats`,
    expectStatus: 200,
    critical: false,
    description: 'Event Seats (read-only GET endpoint that returns seat availability)'
  }
];

async function checkOne(check) {
  const started = Date.now();
  try {
    const res = await fetch(check.url, {
      method: check.method,
      redirect: 'manual', // don't follow redirects - we want to see the 303
      headers: { 'User-Agent': 'FormHealthCheck/1.0' }
    });
    const elapsedMs = Date.now() - started;
    const ok = res.status === check.expectStatus;
    return {
      ...check,
      status: res.status,
      elapsedMs,
      ok,
      failReason: ok ? null : `got HTTP ${res.status}, expected ${check.expectStatus}`
    };
  } catch (err) {
    return {
      ...check,
      status: null,
      elapsedMs: Date.now() - started,
      ok: false,
      failReason: `network error: ${err.message}`
    };
  }
}

async function alertStar(failures) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
  if (!apiKey) return { alerted: false, error: 'no RESEND_API_KEY' };
  const lines = [
    'URGENT: One or more critical forms/endpoints on starjessetaylor.com are failing.',
    '',
    'Failed checks:',
    ''
  ];
  failures.forEach(f => {
    lines.push(`  ✗ ${f.description}`);
    lines.push(`     URL: ${f.url}`);
    lines.push(`     Reason: ${f.failReason}`);
    lines.push(`     Response time: ${f.elapsedMs}ms`);
    lines.push('');
  });
  lines.push('If a form endpoint is down, buyers or applicants are being silently lost.');
  lines.push('');
  lines.push('Check Vercel logs: https://vercel.com/dashboard');
  lines.push('');
  lines.push('This alert was generated by the form-health-check cron running daily at 5 AM PT.');

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Health Check <star@starjessetaylor.com>',
      to: [notifyTo],
      subject: `URGENT: ${failures.length} form endpoint(s) failing — check ASAP`,
      text: lines.join('\n')
    })
  });
  return { alerted: send.ok, status: send.status };
}

export default async function handler(req, res) {
  // Allow cron and manual triggering with CRON_SECRET
  const providedKey = req.query?.key || req.headers['x-cron-secret'];
  const cronSecret = process.env.CRON_SECRET;
  const isCron = req.headers['user-agent']?.includes('vercel-cron') || providedKey === cronSecret;

  const results = await Promise.all(CHECKS.map(checkOne));
  const criticalFailures = results.filter(r => !r.ok && r.critical);
  const nonCriticalFailures = results.filter(r => !r.ok && !r.critical);

  let alerted = false;
  if (criticalFailures.length > 0) {
    const alert = await alertStar(criticalFailures);
    alerted = !!alert.alerted;
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    totalChecks: results.length,
    passed: results.filter(r => r.ok).length,
    criticalFailures: criticalFailures.length,
    nonCriticalFailures: nonCriticalFailures.length,
    alerted,
    results: results.map(r => ({
      name: r.name,
      ok: r.ok,
      status: r.status,
      expected: r.expectStatus,
      elapsedMs: r.elapsedMs,
      failReason: r.failReason
    }))
  };

  return res.status(criticalFailures.length > 0 ? 503 : 200).json(summary);
}
