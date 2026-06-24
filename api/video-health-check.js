/**
 * Daily Video Health Check for YouTube embeds across the site.
 *
 * Runs once per day via Vercel cron. Crawls a known list of pages on
 * starjessetaylor.com, extracts every YouTube video ID from iframe
 * src attributes, then calls YouTube's oembed API for each to verify
 * the video still allows embedding.
 *
 * If ANY video fails (deleted, embed disabled, privacy restricted, etc.),
 * emails Star at star@starjessetaylor.com with the broken list,
 * which page(s) it lives on, and a direct YouTube link to investigate.
 *
 * If all videos pass, silence is success (no email).
 *
 * Built June 25, 2026 after Star surfaced the recurring "videos go gray"
 * issue. Goal: never be unaware of a broken video on the site for
 * more than 24 hours.
 *
 * Scheduling: configured in vercel.json with a daily cron at 15:00 UTC
 * (8 AM Pacific), one hour after the form health check.
 */

const SITE_URL = 'https://starjessetaylor.com';

// Pages known to contain YouTube embeds. Add new pages here when they're created.
// The check fetches LIVE production HTML, so it auto-detects new IDs as long as
// the page is in this list.
const PAGES_TO_CHECK = [
  '/',
  '/event.html',
  '/cohort.html',
  '/services.html',
  '/about.html',
  '/courses.html',
  '/whats-next',
  '/whats-next.html',
  '/tour.html',
  '/book.html',
  '/breakthrough-blueprint.html',
  '/self-worth-course.html',
  '/healthy-relationship.html',
];

async function extractVideoIdsFromPage(pagePath) {
  const url = `${SITE_URL}${pagePath}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      return { pagePath, status: res.status, ids: [] };
    }
    const html = await res.text();
    // Match both youtube.com/embed and youtube-nocookie.com/embed iframes
    const regex = /(?:youtube(?:-nocookie)?\.com\/embed\/)([a-zA-Z0-9_-]{11})/g;
    const ids = new Set();
    let match;
    while ((match = regex.exec(html)) !== null) {
      ids.add(match[1]);
    }
    return { pagePath, status: 200, ids: Array.from(ids) };
  } catch (err) {
    return { pagePath, status: 0, ids: [], error: err.message };
  }
}

async function checkVideoEmbed(videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    return {
      videoId,
      status: res.status,
      working: res.status === 200,
    };
  } catch (err) {
    return {
      videoId,
      status: 0,
      working: false,
      error: err.message,
    };
  }
}

function describeFailure(status) {
  switch (status) {
    case 401:
      return 'PRIVATE or login required';
    case 403:
      return 'EMBED DISABLED by uploader';
    case 404:
      return 'VIDEO DELETED';
    case 0:
      return 'NETWORK ERROR';
    default:
      return `Status ${status}`;
  }
}

async function sendAlertEmail(brokenVideos, summary) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing, cannot send alert');
    return;
  }

  const lines = brokenVideos.map((v) => {
    return [
      `🚨 ${v.videoId} — ${describeFailure(v.status)}`,
      `   Lives on: ${v.pages.join(', ')}`,
      `   YouTube: https://youtube.com/watch?v=${v.videoId}`,
      ``,
    ].join('\n');
  });

  const text = [
    `Video health check found broken embeds on starjessetaylor.com.`,
    ``,
    `${brokenVideos.length} of ${summary.totalVideos} videos failed.`,
    `Checked ${summary.pagesChecked} pages.`,
    ``,
    `BROKEN VIDEOS:`,
    ``,
    ...lines,
    `Fix or replace each video on the affected page(s).`,
    `Common fixes: re-record, swap to a working video, or remove the embed.`,
    ``,
    `Run again manually: https://starjessetaylor.com/api/video-health-check`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Video Health Check <hello@starjessetaylor.com>',
        to: ['star@starjessetaylor.com'],
        cc: ['starjessetaylor@gmail.com'],
        subject: `🚨 ${brokenVideos.length} broken video(s) on the website`,
        text,
      }),
    });
    if (!res.ok) {
      console.error('Resend send failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Email send threw:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth: allow Vercel cron OR a manual call with the CRON_SECRET.
  // Vercel cron requests include a 'x-vercel-cron' header set to '1'.
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthorized = req.query.key === process.env.CRON_SECRET;
  if (!isVercelCron && !isAuthorized && req.method !== 'GET') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();

  // Step 1: extract video IDs from every page in parallel
  const pageResults = await Promise.all(PAGES_TO_CHECK.map(extractVideoIdsFromPage));

  // Step 2: build a map of videoId -> pages where it lives
  const videoToPages = new Map();
  for (const result of pageResults) {
    for (const id of result.ids) {
      if (!videoToPages.has(id)) videoToPages.set(id, new Set());
      videoToPages.get(id).add(result.pagePath);
    }
  }

  const allVideoIds = Array.from(videoToPages.keys());

  // Step 3: check each unique video via oembed (in parallel)
  const checks = await Promise.all(allVideoIds.map(checkVideoEmbed));

  // Step 4: identify broken videos
  const broken = checks
    .filter((c) => !c.working)
    .map((c) => ({
      ...c,
      pages: Array.from(videoToPages.get(c.videoId) || []),
    }));

  const summary = {
    pagesChecked: PAGES_TO_CHECK.length,
    pagesWithErrors: pageResults.filter((p) => p.status >= 400).length,
    totalVideos: allVideoIds.length,
    brokenVideos: broken.length,
    durationMs: Date.now() - startedAt,
  };

  // Step 5: alert if anything broken
  if (broken.length > 0) {
    await sendAlertEmail(broken, summary);
  }

  return res.status(200).json({
    healthy: broken.length === 0,
    summary,
    broken,
  });
}
