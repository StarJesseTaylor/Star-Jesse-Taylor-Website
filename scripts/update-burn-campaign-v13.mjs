#!/usr/bin/env node
/**
 * v13 — REFRAME the email toward workshop-led positioning:
 * - Section header pivots to "stay on track" language
 * - Workshop becomes the lead bullet (Saturday August 15, included)
 * - Weekly calls renamed to "Staying On Track calls"
 * - Updated paragraph copy to emphasize the 3 distinct jobs (calls/workshop/cohort)
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

// CHANGE 1: Update the support paragraphs in "Get support so the brain stops pulling you back" section
const oldSupportParagraphs = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need support to stay on track when the old patterns, the old algorithm, continue to try to pull you in.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">That's why I built the community. To help you stay on track and move forward in the direction of what you actually care about.</p>`;

const newSupportParagraphs = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need support to stay on track when the old patterns, the old algorithm, continue to try to pull you in.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">That's why I'm running an online workshop. <strong>Saturday, August 15.</strong> Where we go deep into changing your brain's algorithm together.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop happens inside the community I'm launching July 1st. And inside the community, you also get my weekly Staying On Track calls. Helping you with your problems and challenges. Helping you stay on track in the direction of the life you actually want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is where we go deep. The weekly calls keep you on track week to week. The community is the room where you do both.</p>`;

if (!html.includes(oldSupportParagraphs)) {
  console.error('ERROR: Could not find support paragraphs.');
  process.exit(1);
}
html = html.replace(oldSupportParagraphs, newSupportParagraphs);
console.log('  ✓ updated support paragraphs with workshop-led framing');

// CHANGE 2: Update the bullets — workshop becomes the lead, weekly calls become "Staying On Track calls"
const oldBullets = `<li>Weekly live calls with me. Helping you with your problems and challenges and finding a new direction. First call July 1st.</li>
<li>A community of like-minded and good-hearted people who want to grow</li>
<li>Meditation and EFT we do together</li>
<li>Direct access to me in the feed</li>
<li>Tools like the Wins of the Day, to celebrate your actions instead of trying to fix your emotions and thoughts</li>
<li>Future workshops drop here first</li>`;

const newBullets = `<li><strong>My online workshop on Saturday, August 15 — included.</strong> Where we go deep into changing your brain's algorithm.</li>
<li><strong>Weekly Staying On Track calls with me.</strong> Helping you with your problems and challenges. Helping you stay on track in the direction of the life you want. First call July 1st.</li>
<li>A community of like-minded and good-hearted people who want to grow</li>
<li>Meditation and EFT we do together</li>
<li>Direct access to me in the feed</li>
<li>Tools like the Wins of the Day, to celebrate your actions instead of trying to fix your emotions and thoughts</li>`;

if (!html.includes(oldBullets)) {
  console.error('ERROR: Could not find bullets block.');
  process.exit(1);
}
html = html.replace(oldBullets, newBullets);
console.log('  ✓ workshop now lead bullet, weekly calls renamed Staying On Track');

console.log('\nUpdating campaign with v13 (workshop-led reframe)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('✓ v13 applied. No test sent (Star still iterating).');
