#!/usr/bin/env node
/**
 * Update burn campaign v5 — Brain section rewrite:
 * - New header: "But your brain is trying to get you back onto the battleground"
 * - Expanded fire metaphor with engagement + oxygen
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

const OLD_BRAIN_SECTION = `<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is still chasing you</h2>
</td></tr>

<tr><td style="padding:0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to attack you for some time.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You put firewood on this fire for years. It still has to burn.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">That's normal. You don't have to stop the fire. You just have to stop putting more wood on.</p>
</td></tr>`;

const NEW_BRAIN_SECTION = `<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>
</td></tr>

<tr><td style="padding:0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to try to pull you back into the thoughts and emotions.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Don't think just because you changed direction, the brain is not trying to chase after you.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">This is because you showed your brain for a long time that you want to be on the battleground.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">It's like a fire that has to keep burning for a while because you kept adding firewood to it.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The firewood you kept adding is the engagement with your thoughts and emotions.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Over time, when you don't engage anymore, the fire is going to stop burning. You're going to stop giving it oxygen.</p>
</td></tr>`;

let updatedHtml = current.html.replace(OLD_BRAIN_SECTION, NEW_BRAIN_SECTION);

if (updatedHtml === current.html) {
  console.error('ERROR: replacement did NOT match. Old section not found in current HTML.');
  process.exit(1);
}

console.log('Updating campaign with v5 changes...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html: updatedHtml, plain_text: current.plain_text }),
});

console.log('✓ Updated. No test sent yet — Star still dictating.');
