#!/usr/bin/env node
/**
 * v11 — multiple Star edits from read-through:
 * - Add new paragraph about "the more you do those actions, the more confident you become"
 * - REMOVE the stock fire image
 * - Move image15 (full workshop group) to under Justina's quote
 * - Move image25 (Star with workshop participants) to closing position
 * - Use Justina's FULL Message 1 quote (verbatim) MINUS the volunteer/work-offer line
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

// CHANGE 1: Add new paragraph about "the more you do those actions, the more confident"
// Insert between "...brain will give you more of that" and "Your brain wants to answer the questions"
const oldBehaviorBlock = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer the questions. So ask the questions that support you. Once you have the answer, you navigate your life in that direction.</p>`;

const newBehaviorBlock = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The more you do those actions, the more they become normal. They become familiar to the brain. You become more confident in those situations. You become more confident living your life. The life that you want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer the questions. So ask the questions that support you. Once you have the answer, you navigate your life in that direction.</p>`;

if (!html.includes(oldBehaviorBlock)) {
  console.error('ERROR: Could not find behavior block to insert new paragraph.');
  process.exit(1);
}
html = html.replace(oldBehaviorBlock, newBehaviorBlock);
console.log('  ✓ added "more confident" paragraph');

// CHANGE 2: REMOVE the fire image
const oldFireImage = `<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/fire.jpg?v=10" alt="Fire and firewood" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

`;

if (html.includes(oldFireImage)) {
  html = html.replace(oldFireImage, '');
  console.log('  ✓ removed fire stock image');
}

// CHANGE 3: Update Justina quote to FULL Message 1 (minus the volunteer offer)
const oldJustinaBox = `<div style="background:#f6f4ef;padding:24px;border-radius:6px;margin:0 0 30px;">
<p style="margin:0 0 12px;font-size:15px;line-height:1.65;font-style:italic;color:#1c1c1c;">"I was able to unlock something I had been struggling with for years. It was one of the most welcoming events I've gone to. There was a sense of 'you are seen and you matter here.'"</p>
<p style="margin:0;font-size:14px;color:#666;">— Justina, May 30 LA workshop</p>
</div>`;

const newJustinaBox = `<div style="background:#f6f4ef;padding:24px;border-radius:6px;margin:0 0 30px;">
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;font-style:italic;color:#1c1c1c;">"Star!!!! Thank you soooooo much for the in-person workshop in LA. It was so transformative for me. I was able to unlock something I have been struggling with for yearsssss.</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.65;font-style:italic;color:#1c1c1c;">Your love and deep care for people and this work was felt and soo inspiring! It was one of the most welcoming (it felt warm and there was a sense of 'you are seen and you matter here') event I've gone to (I've been to many personal development events)."</p>
<p style="margin:0;font-size:14px;color:#666;">— Justina, May 30 LA workshop</p>
</div>`;

if (!html.includes(oldJustinaBox)) {
  console.error('ERROR: Could not find Justina quote box to update.');
  process.exit(1);
}
html = html.replace(oldJustinaBox, newJustinaBox);
console.log('  ✓ Justina full quote (Message 1 verbatim, minus volunteer offer)');

// CHANGE 4 + 5: Swap mid image (was image25) and closing image (was image15)
// MID position: was image25 → now image15 (full group shot)
// CLOSING position: was image15 → now image25 (Star with workshop participants)

// Step A: Mark current mid image25 with a temp string
html = html.replace(
  /image25\.jpg\?v=10" alt="Star with workshop participants"/g,
  '__TEMP_MID__.jpg?v=11" alt="The LA workshop room — everyone in the same direction"'
);

// Step B: Closing image15 → image25
html = html.replace(
  /image15\.jpg\?v=10" alt="The LA workshop room — everyone going in the same direction"/g,
  'image25.jpg?v=11" alt="Star with workshop participants"'
);

// Step C: Resolve temp to image15
html = html.replace(/__TEMP_MID__/g, 'image15');

console.log('  ✓ image15 now under Justina quote, image25 now at closing');

// Bump cache on hero
html = html.replace(/star-hero\.jpg\?v=\d+/g, 'star-hero.jpg?v=11');

console.log('\nUpdating campaign with v11...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html, plain_text: current.plain_text }),
});

console.log('Sending fresh test...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: ['starjessetaylor@gmail.com'], send_type: 'html' }),
});

console.log('\n✓ v11 applied. Test sent.');
