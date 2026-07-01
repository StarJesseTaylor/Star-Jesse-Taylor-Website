#!/usr/bin/env node
/**
 * Update burn campaign v9 — add the culture / garden paragraph.
 * Star: "This will be a community of good-hearted, talented people who know what it means to be supportive, respectful, encouraging human beings.
 * I will be very protective of the culture so we are creating an amazing atmosphere that supports everyone.
 * Like a garden that is watered well and given sunshine, so it nurtures and we nurture the garden."
 *
 * Placement: after "first people" line, before "What you get inside" bullets.
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

const oldFirstPeopleLine = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list. You get the invitation as one of the first people.</p>`;

const newWithCulture = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list. You get the invitation as one of the first people.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">This will be a community of good-hearted, talented people who know what it means to be supportive, respectful, encouraging human beings.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">I will be very protective of the culture. We are creating an amazing atmosphere that supports everyone.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Like a garden that is watered well and given sunshine. It nurtures, and we nurture the garden.</p>`;

if (!html.includes(oldFirstPeopleLine)) {
  console.error('ERROR: Could not find first-people line to insert culture paragraph after.');
  process.exit(1);
}

html = html.replace(oldFirstPeopleLine, newWithCulture);

console.log('Updating campaign with v9 (culture + garden paragraph)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('✓ Updated.');
