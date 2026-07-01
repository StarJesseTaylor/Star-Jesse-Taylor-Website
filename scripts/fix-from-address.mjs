#!/usr/bin/env node
/**
 * Fix the From address everywhere it matters:
 *   1. MailChimp campaign 434148f526 → star@starjessetaylor.com
 *   2. AC message 11 (community v17) → star@starjessetaylor.com
 *   3. AC message 12 (workshop v16) → star@starjessetaylor.com
 *
 * Reply-to stays star@starjessetaylor.com too.
 */
import fs from 'fs';

const FROM_NAME  = 'Star Jesse Taylor';
const FROM_EMAIL = 'star@starjessetaylor.com';
const REPLY_TO   = 'star@starjessetaylor.com';

const mc = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

// === MailChimp ===
console.log('=== MAILCHIMP ===');
const mcAuth = `Basic ${Buffer.from(`apikey:${mc.api_key}`).toString('base64')}`;
const mcRes = await fetch(`https://${mc.server}.api.mailchimp.com/3.0/campaigns/434148f526`, {
  method: 'PATCH',
  headers: { Authorization: mcAuth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    settings: {
      from_name: FROM_NAME,
      reply_to: REPLY_TO,
    },
  }),
});
console.log(`status: ${mcRes.status}`);
if (!mcRes.ok) console.log((await mcRes.text()).slice(0, 500));
else console.log(`✓ MC campaign 434148f526 from_name="${FROM_NAME}" reply_to="${REPLY_TO}"`);

// === ActiveCampaign messages ===
console.log('\n=== ACTIVECAMPAIGN ===');
async function fixACMessage(id, label) {
  const r = await fetch(`${ac.apiUrl}/api/3/messages/${id}`, {
    method: 'PUT',
    headers: { 'Api-Token': ac.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        fromname: FROM_NAME,
        fromemail: FROM_EMAIL,
        reply2: REPLY_TO,
      },
    }),
  });
  console.log(`msg ${id} (${label}): ${r.status}`);
  if (!r.ok) console.log((await r.text()).slice(0, 500));
}
await fixACMessage(11, 'Community v17');
await fixACMessage(12, 'Workshop v16');

console.log('\nDone.');
