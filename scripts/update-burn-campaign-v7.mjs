#!/usr/bin/env node
/**
 * Update burn campaign v7 — bullet rewrites:
 * - "A room of people moving in the same direction" → "A community of like-minded and good-hearted people who want to grow"
 * - "Daily wins from the room" → "Tools like the Wins of the Day, to celebrate your actions instead of trying to fix your emotions and thoughts"
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

html = html.replace(
  `<li>A room of people moving in the same direction</li>`,
  `<li>A community of like-minded and good-hearted people who want to grow</li>`
);

html = html.replace(
  `<li>Daily wins from the room</li>`,
  `<li>Tools like the Wins of the Day, to celebrate your actions instead of trying to fix your emotions and thoughts</li>`
);

console.log('Updating campaign with v7 changes...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('✓ Updated. No test sent yet — Star still dictating.');
