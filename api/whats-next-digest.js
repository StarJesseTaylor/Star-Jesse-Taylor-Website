/**
 * Daily digest of /whats-next signups.
 *
 * Runs once a day via Vercel cron. Queries ActiveCampaign for any contact
 * tagged `interest:skool-community` created in the last 24 hours, formats
 * a short summary, and sends ONE email to Star with the list.
 *
 * Resend quota strategy: only sends an email when there's at least one new
 * signup. Zero signups = no email, no waste.
 *
 * Built June 24 2026 after Star surfaced that he was unaware signups were
 * happening because the system only sends confirmation emails to the
 * signup user, never to Star.
 *
 * Scheduling: configured in vercel.json with a daily cron at 14:00 UTC
 * (7 AM Pacific), so Star sees the previous day's signups with morning coffee.
 */

const TAG_NAME = 'interest:skool-community';

async function acFetch(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`AC ${url} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth: allow Vercel cron OR a manual call with CRON_SECRET.
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthorized = req.query.key === process.env.CRON_SECRET;
  if (!isVercelCron && !isAuthorized && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  if (!AC_KEY) {
    console.error('ACTIVECAMPAIGN_API_KEY missing');
    return res.status(500).json({ error: 'Config error' });
  }
  const acHeaders = { 'Api-Token': AC_KEY };

  // Find the tag id
  const tagSearch = await acFetch(
    `${AC_URL}/api/3/tags?search=${encodeURIComponent(TAG_NAME)}`,
    acHeaders
  );
  const tag = (tagSearch.tags || []).find((t) => t.tag === TAG_NAME);
  if (!tag) {
    return res.status(200).json({ ok: true, signups: 0, reason: 'tag does not exist yet' });
  }

  // List contacts with that tag (most recent first)
  const list = await acFetch(
    `${AC_URL}/api/3/contacts?tagid=${tag.id}&orders[cdate]=DESC&limit=100`,
    acHeaders
  );
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const recent = (list.contacts || []).filter((c) => {
    if (!c.cdate) return false;
    return new Date(c.cdate).getTime() > cutoffMs;
  });

  // Zero signups = no email sent. Saves Resend quota.
  if (recent.length === 0) {
    return res.status(200).json({ ok: true, signups: 0 });
  }

  // Format the digest
  const rows = recent
    .map((c) => {
      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)';
      const when = c.cdate;
      return `  ${name.padEnd(28)} ${c.email.padEnd(40)} ${when}`;
    })
    .join('\n');

  const text = [
    `${recent.length} new /whats-next signup(s) in the last 24 hours.`,
    '',
    rows,
    '',
    `View all contacts in AC: https://starjessetaylor92181.activehosted.com/app/contacts/`,
    `Filter by tag: ${TAG_NAME}`,
  ].join('\n');

  // Send via Resend
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return res.status(200).json({ ok: false, signups: recent.length, reason: 'no resend key' });
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Signups <hello@starjessetaylor.com>',
        to: ['star@starjessetaylor.com'],
        cc: ['starjessetaylor@gmail.com'],
        subject: `${recent.length} new signup${recent.length === 1 ? '' : 's'} on /whats-next yesterday`,
        text,
      }),
    });
  } catch (err) {
    console.error('Digest send failed:', err);
  }

  return res.status(200).json({ ok: true, signups: recent.length });
}
