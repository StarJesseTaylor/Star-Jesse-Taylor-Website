#!/usr/bin/env node
/**
 * Update burn campaign v8 — REMOVE the Founding Member Bonuses section entirely.
 * Star: "These are things I never told you to write. So unnecessary. No one cares."
 * Replace with simple: $49 a month, locked even when standard goes to $97. 7-day trial below.
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

// Remove the entire Founding Member Bonuses section + simplify the offer block
// The current structure has:
// 1. "What you get inside" h3 + ul
// 2. "Founding member bonuses (first 100 only)" h3 + ul (THIS GETS CUT)
// 3. "7-day free trial. Cancel in one click." paragraph

const oldOfferBlock = `<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">Founding member bonuses (first 100 only):</h3>
<ul style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.85;">
<li>My Self-Worth Course included free ($99 value)</li>
<li>Monthly Founding Circle Zoom (just the 100 of you and me)</li>
<li>$50 off any future workshop</li>
<li>Founding Member badge</li>
<li>Your $49 rate stays the same even when standard goes up to $97</li>
</ul>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">7-day free trial. Cancel in one click.</p>`;

const newOfferBlock = `<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month, locked. Even when it goes to $97.</p>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">7-day free trial. Cancel in one click.</p>`;

if (!html.includes(oldOfferBlock)) {
  console.error('ERROR: Could not find founding member bonuses block to remove.');
  process.exit(1);
}

html = html.replace(oldOfferBlock, newOfferBlock);

// Also remove the "You can get in right now for $49 a month / Your price stays at $49..." paragraphs above
// (they duplicate the simplified line)
const oldPriceLines = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You can get in right now for <strong>$49 a month</strong>.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Your price stays at $49 even when I raise it later.</p>`;

if (html.includes(oldPriceLines)) {
  html = html.replace(oldPriceLines, '');
  console.log('  removed duplicate price paragraphs');
}

console.log('Updating campaign with v8 (simplified offer)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('✓ Updated.');
