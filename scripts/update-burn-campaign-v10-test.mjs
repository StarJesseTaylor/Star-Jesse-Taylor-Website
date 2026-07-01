#!/usr/bin/env node
/**
 * v10: Swap closing image image30 -> image15 (full group room shot — most impactful for community climax).
 * Also send fresh test to Star.
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

// Swap closing image image30 -> image15 (full group shot)
html = html.replace(/image30\.jpg\?v=\d+/g, 'image15.jpg?v=10');
html = html.replace(/alt="Connection at LA workshop"/g, 'alt="The LA workshop room — everyone going in the same direction"');

// Bump cache version on existing images
html = html.replace(/star-hero\.jpg\?v=\d+/g, 'star-hero.jpg?v=10');
html = html.replace(/fire\.jpg\?v=\d+/g, 'fire.jpg?v=10');
html = html.replace(/image25\.jpg\?v=\d+/g, 'image25.jpg?v=10');

console.log('Updating campaign with v10 (image swap + cache bust)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('Sending fresh test to starjessetaylor@gmail.com...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: ['starjessetaylor@gmail.com'], send_type: 'html' }),
});

console.log('\n✓ Test sent. Check your gmail in 1-2 minutes.');
console.log('Image lineup:');
console.log('  - HERO: star-hero.jpg (clear shot of Star)');
console.log('  - FIRE: fire.jpg (stock fire/firewood — visualizes the metaphor)');
console.log('  - MID: image25.jpg (Star with workshop participants — community)');
console.log('  - CLOSING: image15.jpg (full LA workshop room — community climax)');
