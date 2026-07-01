#!/usr/bin/env node
/**
 * v12 — Add Star's downloaded images:
 * - brain-overthinking.jpg → after stop-fighting section, before Questions section
 * - fire.jpg → back in brain section (right after the "But your brain is trying to get you back onto the battleground" header)
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

// CHANGE 1: Insert brain-overthinking image AFTER "Show your brain you don't care about fighting anymore" closing line,
// BEFORE the Questions section header divider
const brainOverthinkingAnchor = `<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">That's how you show your brain you don't care about fighting anymore.</p>
</td></tr>

<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">The questions that change the direction</h2>
</td></tr>`;

const brainOverthinkingBlock = `<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">That's how you show your brain you don't care about fighting anymore.</p>
</td></tr>

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/brain-overthinking.jpg?v=12" alt="Brain on the battleground" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:36px 32px 0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">The questions that change the direction</h2>
</td></tr>`;

if (!html.includes(brainOverthinkingAnchor)) {
  console.error('ERROR: Could not find anchor for brain-overthinking image.');
  process.exit(1);
}
html = html.replace(brainOverthinkingAnchor, brainOverthinkingBlock);
console.log('  ✓ added brain-overthinking image after stop-fighting section');

// CHANGE 2: Add fire image back into brain section (right after "But your brain is trying to get you back onto the battleground" h2)
const brainSectionHeader = `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>
</td></tr>

<tr><td style="padding:0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to try to pull you back into the thoughts and emotions.</p>`;

const brainSectionWithFire = `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>
</td></tr>

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/fire.jpg?v=12" alt="Fire with firewood" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:30px 32px 0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to try to pull you back into the thoughts and emotions.</p>`;

if (!html.includes(brainSectionHeader)) {
  console.error('ERROR: Could not find brain section header for fire image insert.');
  process.exit(1);
}
html = html.replace(brainSectionHeader, brainSectionWithFire);
console.log('  ✓ added fire image at top of brain section');

console.log('\nUpdating campaign with v12...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('Sending fresh test...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: ['starjessetaylor@gmail.com'], send_type: 'html' }),
});

console.log('\n✓ v12 applied. Test sent.');
console.log('\nFinal image lineup (5 images):');
console.log('  1. HERO: star-hero.jpg (you, clear)');
console.log('  2. AFTER STOP-FIGHTING: brain-overthinking.jpg (battleground in head)');
console.log('  3. BRAIN SECTION TOP: fire.jpg (firewood / fire metaphor)');
console.log('  4. AFTER JUSTINA QUOTE: image15.jpg (full LA workshop room)');
console.log('  5. CLOSING: image25.jpg (you with workshop participants)');
