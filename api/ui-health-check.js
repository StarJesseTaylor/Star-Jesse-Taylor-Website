// UI Health Check
// Runs daily (see vercel.json cron). Catches critical frontend breakage that
// form-health-check can't catch:
//   - Nav v2 script missing or broken
//   - Skool banner script missing or broken
//   - Hamburger button not on the page
//   - Coaching page accidentally getting the Skool banner (violates Star's rule)
//   - Key JS files not serving 200
//   - Key pages not serving 200
//
// If ANY critical check fails, sends URGENT email to Star's ops address
// so mobile nav / conversion-critical UI can't silently break for a day.
//
// Trigger: cron /api/ui-health-check at 5:10am PT daily
// Also can be hit on-demand via curl.

export const config = { runtime: 'nodejs' };

const SITE_URL = process.env.SITE_URL || 'https://starjessetaylor.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STAR_NOTIFY_EMAIL = process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>';

// Each check gets a name, target URL, expected status, and required content
// substrings (all must be present). If ANY substring is missing, check fails.
const CHECKS = [
  // Key pages return 200 + include the nav/banner scripts + hamburger button
  {
    name: 'homepage-nav-scripts',
    url: `${SITE_URL}/`,
    expectStatus: 200,
    requiredSubstrings: [
      'js/nav-v2.js',
      'js/skool-banner.js',
      'nav-hamburger',
      '<nav class="nav">'
    ],
    critical: true,
    description: 'Homepage must include nav-v2 + skool-banner scripts and hamburger element'
  },
  {
    name: 'about-nav-scripts',
    url: `${SITE_URL}/about`,
    expectStatus: 200,
    requiredSubstrings: ['js/nav-v2.js', 'js/skool-banner.js', 'nav-hamburger'],
    critical: true,
    description: 'About page must have nav + banner scripts'
  },
  {
    name: 'book-nav-scripts',
    url: `${SITE_URL}/book`,
    expectStatus: 200,
    requiredSubstrings: ['js/nav-v2.js', 'js/skool-banner.js', 'nav-hamburger'],
    critical: true,
    description: 'Book page must have nav + banner scripts'
  },
  // JS files themselves must return 200 + contain expected marker strings
  {
    name: 'nav-v2-js',
    url: `${SITE_URL}/js/nav-v2.js`,
    expectStatus: 200,
    requiredSubstrings: [
      'nav-hamburger',
      'nav-mobile',
      'nav-dropdown-menu',
      'Live Calls with Star',
      '7 Days Free'
    ],
    critical: true,
    description: 'js/nav-v2.js must contain hamburger handler + mobile menu + dropdown code'
  },
  {
    name: 'skool-banner-js',
    url: `${SITE_URL}/js/skool-banner.js`,
    expectStatus: 200,
    requiredSubstrings: [
      'One free week of live calls with Star',
      'skool-banner-btn',
      '/community'
    ],
    critical: true,
    description: 'js/skool-banner.js must contain the locked copy + button + community link'
  },
  // Coaching page must NOT include the Skool banner script (Star's rule:
  // protect 1:1 intent, no downsell to community on this page)
  {
    name: 'coaching-no-banner',
    url: `${SITE_URL}/coaching`,
    expectStatus: 200,
    requiredSubstrings: ['nav-v2.js'],
    forbiddenSubstrings: ['skool-banner.js'],
    critical: true,
    description: 'Coaching page must have nav v2 but NOT skool-banner.js (locked rule)'
  },
  // Coaching Stripe payment link on the /coaching page (money-critical)
  {
    name: 'coaching-stripe-link',
    url: `${SITE_URL}/coaching`,
    expectStatus: 200,
    requiredSubstrings: ['buy.stripe.com/cN2eYg7kHepv1uocNw'],
    critical: true,
    description: 'Coaching page must contain the live Clarity Session Stripe payment link'
  },
  // Katie Hayman + Marissa video testimonials must be on /coaching (Star's rule:
  // Katie is at TOP of page, Marissa follows. Any regression removes these).
  {
    name: 'coaching-katie-video',
    url: `${SITE_URL}/coaching`,
    expectStatus: 200,
    requiredSubstrings: ['KJcgDLzLTgo', 'Katie Hayman'],
    critical: true,
    description: 'Coaching page MUST feature Katie Hayman video testimonial at top'
  },
  {
    name: 'coaching-marissa-video',
    url: `${SITE_URL}/coaching`,
    expectStatus: 200,
    requiredSubstrings: ['_PRq3vqmUQU', 'Marissa'],
    critical: true,
    description: 'Coaching page MUST feature Marissa video testimonial'
  },
  // Book funnel end-to-end
  {
    name: 'book-checkout',
    url: `${SITE_URL}/api/book-checkout`,
    expectStatus: 303,
    critical: true,
    description: 'Book checkout endpoint must redirect to Stripe (303)'
  },
  // EVERY NAV LINK must return 200 (or a valid redirect). This catches the
  // "clicked Group Coaching, got 404" class of breakage that made Star look bad.
  { name: 'nav-home', url: `${SITE_URL}/`, expectStatus: 200, critical: true, description: 'Nav: Home' },
  { name: 'nav-about', url: `${SITE_URL}/about`, expectStatus: 200, critical: true, description: 'Nav: About' },
  { name: 'nav-community', url: `${SITE_URL}/community`, expectStatus: 200, critical: true, description: 'Nav: Live Calls with Star (community)' },
  { name: 'nav-coaching', url: `${SITE_URL}/coaching`, expectStatus: 200, critical: true, description: 'Nav dropdown: 1-on-1 Coaching' },
  { name: 'nav-cohort', url: `${SITE_URL}/cohort`, expectStatus: 200, critical: true, description: 'Nav dropdown: Cohort / Group Program' },
  { name: 'nav-event', url: `${SITE_URL}/event`, expectStatus: 200, critical: true, description: 'Nav dropdown: Workshops' },
  { name: 'nav-ask-star', url: `${SITE_URL}/ask-star`, expectStatus: 200, critical: true, description: 'Nav: Ask Star' },
  { name: 'nav-courses', url: `${SITE_URL}/courses`, expectStatus: 200, critical: true, description: 'Nav: Courses' },
  { name: 'nav-book', url: `${SITE_URL}/book`, expectStatus: 200, critical: true, description: 'Nav: Book' },
  { name: 'nav-apply', url: `${SITE_URL}/apply`, expectStatus: 200, critical: true, description: 'Coaching applications' },
  { name: 'nav-apply-package', url: `${SITE_URL}/apply-package`, expectStatus: 200, critical: true, description: 'Coaching package apply' },
];

async function runCheck(check) {
  const start = Date.now();
  try {
    const method = check.method || 'GET';
    const res = await fetch(check.url, {
      method,
      redirect: 'manual',
      headers: { 'User-Agent': 'StarSiteUIHealthCheck/1.0' }
    });
    const elapsedMs = Date.now() - start;
    const status = res.status;
    const body = check.requiredSubstrings || check.forbiddenSubstrings ? await res.text() : '';
    // Status check
    if (status !== check.expectStatus) {
      return {
        name: check.name, ok: false, status, expected: check.expectStatus,
        elapsedMs, failReason: `HTTP ${status}, expected ${check.expectStatus}`,
        critical: !!check.critical
      };
    }
    // Required substrings check
    if (check.requiredSubstrings) {
      const missing = check.requiredSubstrings.filter(s => !body.includes(s));
      if (missing.length > 0) {
        return {
          name: check.name, ok: false, status, expected: check.expectStatus,
          elapsedMs, failReason: `Missing required: ${missing.join(', ')}`,
          critical: !!check.critical
        };
      }
    }
    // Forbidden substrings check
    if (check.forbiddenSubstrings) {
      const found = check.forbiddenSubstrings.filter(s => body.includes(s));
      if (found.length > 0) {
        return {
          name: check.name, ok: false, status, expected: check.expectStatus,
          elapsedMs, failReason: `Found forbidden: ${found.join(', ')}`,
          critical: !!check.critical
        };
      }
    }
    return {
      name: check.name, ok: true, status, expected: check.expectStatus,
      elapsedMs, critical: !!check.critical
    };
  } catch (err) {
    return {
      name: check.name, ok: false, status: 0, expected: check.expectStatus,
      elapsedMs: Date.now() - start, failReason: err.message,
      critical: !!check.critical
    };
  }
}

async function sendAlert(failures) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY missing — cannot send alert email');
    return { sent: false, reason: 'RESEND_API_KEY missing' };
  }
  const criticalFailures = failures.filter(f => f.critical);
  const subject = criticalFailures.length
    ? `URGENT: Star website UI broken (${criticalFailures.length} critical failure${criticalFailures.length > 1 ? 's' : ''})`
    : `Star website UI warning (${failures.length} non-critical failure${failures.length > 1 ? 's' : ''})`;
  const bodyLines = [
    `UI health check ran ${new Date().toISOString()}`,
    ``,
    `${criticalFailures.length} CRITICAL failure${criticalFailures.length !== 1 ? 's' : ''}. Star may be losing conversions.`,
    ``,
    ...failures.map(f => `[${f.critical ? 'CRITICAL' : 'warn'}] ${f.name} — ${f.failReason} (${f.status} vs ${f.expected}, ${f.elapsedMs}ms)`),
    ``,
    `View live: ${SITE_URL}`,
    `Vercel logs: https://vercel.com/starjessetaylor/star-jesse-taylor-website/logs`,
  ];
  const emailBody = bodyLines.join('\n');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [STAR_NOTIFY_EMAIL],
      subject,
      text: emailBody
    })
  });
  return { sent: resp.ok, status: resp.status };
}

export default async function handler(req, res) {
  const results = await Promise.all(CHECKS.map(runCheck));
  const failures = results.filter(r => !r.ok);
  const criticalFailures = failures.filter(f => f.critical);
  let alertResult = { sent: false };
  if (criticalFailures.length > 0) {
    alertResult = await sendAlert(failures);
  }
  const summary = {
    ran: new Date().toISOString(),
    totalChecks: results.length,
    passed: results.filter(r => r.ok).length,
    criticalFailures: criticalFailures.length,
    nonCriticalFailures: failures.length - criticalFailures.length,
    alerted: alertResult.sent,
    results: results.map(r => ({
      name: r.name,
      ok: r.ok,
      status: r.status,
      expected: r.expected,
      elapsedMs: r.elapsedMs,
      failReason: r.failReason
    }))
  };
  res.status(criticalFailures.length > 0 ? 200 : 200).json(summary);
}
