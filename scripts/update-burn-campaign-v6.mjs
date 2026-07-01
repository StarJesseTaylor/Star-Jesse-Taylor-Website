#!/usr/bin/env node
/**
 * Update burn campaign v6 — all the new changes:
 * - Add fire image to brain section
 * - Swap image20 → image25 (Star with workshop participants, not Caleb)
 * - Section header: "Why the LA workshop worked" → "Get support so the brain stops pulling you back into the battleground"
 * - New opening paragraphs in that section (Star verbatim: need support, built the community)
 * - "first people" framing on invite line
 * - Rephrase the "locked forever" lines
 * - Simplify button text
 */

import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const API_KEY = CONFIG.api_key;
const SERVER = CONFIG.server;
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';

const AUTH = `apikey:${API_KEY}`;
const AUTH_HEADER = `Basic ${Buffer.from(AUTH).toString('base64')}`;

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MailChimp API error ${res.status}:`, text); throw new Error(`API call failed: ${path}`); }
  return text ? JSON.parse(text) : {};
}

console.log('Fetching current campaign content...');
const current = await mc(`/campaigns/${CAMPAIGN_ID}/content`);
let html = current.html;

// CHANGE 1: Add fire image right before the brain section header
const fireImageInsertBefore = `<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>
</td></tr>`;

const fireImageBlock = `<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/fire.jpg?v=6" alt="Fire and firewood" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

`;

html = html.replace(fireImageInsertBefore, fireImageBlock + fireImageInsertBefore);

// CHANGE 2: Swap image20 reference to image25
html = html.replace(/image20\.jpg\?v=\d+/g, 'image25.jpg?v=6');
html = html.replace(/alt="LA workshop attendees"/g, 'alt="Star with workshop participants"');

// CHANGE 3 + 4: Replace "Why the LA workshop worked" section header AND add the new opening paragraphs
const oldSectionStart = `<tr><td style="padding:36px 32px 0 32px;">
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">Why the LA workshop worked</h2>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The Los Angeles workshop was so powerful because everyone in the room was going in the same direction. Wanting to grow.</p>`;

// First try with "Los Angeles" - if not present try "LA"
let sectionStartTry1 = oldSectionStart;
let sectionStartTry2 = oldSectionStart.replace('Los Angeles', 'LA');

const newSectionStart = `<tr><td style="padding:36px 32px 0 32px;">
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">Get support so the brain stops pulling you back into the battleground</h2>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need support to stay on track when the old patterns, the old algorithm, continue to try to pull you in.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">That's why I built the community. To help you stay on track and move forward in the direction of what you actually care about.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The Los Angeles workshop was so powerful because everyone in the room was going in the same direction. Wanting to grow.</p>`;

if (html.includes(sectionStartTry1)) {
  html = html.replace(sectionStartTry1, newSectionStart);
} else if (html.includes(sectionStartTry2)) {
  html = html.replace(sectionStartTry2, newSectionStart);
} else {
  console.error('WARN: Could not find "Why the LA workshop worked" section to replace');
}

// CHANGE 5: "first people" framing
html = html.replace(
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list, so you get in before everyone else.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list. You get the invitation as one of the first people.</p>`
);

// CHANGE 6: Rephrase "locked forever" - main line
html = html.replace(
  `<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">You can get in right now for <strong>$49/month, locked forever</strong>.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You can get in right now for <strong>$49 a month</strong>.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Your price stays at $49 even when I raise it later.</p>`
);

// CHANGE 7: Rephrase bonus stack
html = html.replace(
  `<li>$49/month locked forever, even when standard goes to $97</li>`,
  `<li>Your $49 rate stays the same even when standard goes up to $97</li>`
);

// CHANGE 8: Simplify button
html = html.replace(
  `<a href="https://starjessetaylor.com/whats-next?source=mailchimp_burn" style="display:inline-block;padding:18px 36px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Come in now → $49/month locked forever</a>`,
  `<a href="https://starjessetaylor.com/whats-next?source=mailchimp_burn" style="display:inline-block;padding:18px 36px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Come in now → $49 a month</a>`
);

// CHANGE 9: Update the "Weekly live call" bullet — remove "Mondays 7pm Pacific", add framing + first call date
html = html.replace(
  `<li>Weekly live call with me, Mondays 7pm Pacific</li>`,
  `<li>Weekly live calls with me. Helping you with your problems and challenges and finding a new direction. First call July 1st.</li>`
);

console.log('Updating campaign with v6 changes...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('✓ Updated. No test sent yet — Star still dictating.');
