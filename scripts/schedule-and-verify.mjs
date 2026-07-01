#!/usr/bin/env node
/**
 * Final: push v17-FINAL, set subject, schedule for 9 AM Pacific Saturday June 28 2026,
 * then triple-check via API + report verified state.
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const BASE = `https://${CONFIG.server}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';
const AUTH = `Basic ${Buffer.from(`apikey:${CONFIG.api_key}`).toString('base64')}`;

const SUBJECT = 'Are you tired of constantly fighting with your brain?';
const PREVIEW = "Why you can't stop fighting your brain, and what to do instead.";
// 9:00 AM Pacific Saturday June 28 2026 = 16:00 UTC (PDT is UTC-7 in June)
const SCHEDULE_UTC = '2026-06-28T16:00:00+00:00';

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MC ${res.status} on ${path}: ${text.slice(0, 400)}`); throw new Error(`failed ${path}`); }
  return text ? JSON.parse(text) : {};
}

const html = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');

console.log('STEP 1: Push final HTML...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, { method: 'PUT', body: JSON.stringify({ html }) });
console.log(`  ✓ HTML pushed (${html.length} chars)`);

console.log('STEP 2: Set subject + preview...');
await mc(`/campaigns/${CAMPAIGN_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ settings: { subject_line: SUBJECT, preview_text: PREVIEW } }),
});
console.log(`  ✓ Subject: ${SUBJECT}`);
console.log(`  ✓ Preview: ${PREVIEW}`);

console.log(`STEP 3: Schedule for ${SCHEDULE_UTC}...`);
await mc(`/campaigns/${CAMPAIGN_ID}/actions/schedule`, {
  method: 'POST',
  body: JSON.stringify({ schedule_time: SCHEDULE_UTC, timewarp: false }),
});
console.log(`  ✓ Schedule API call succeeded`);

console.log('STEP 4: TRIPLE-CHECK via API fetch...');
const c = await mc(`/campaigns/${CAMPAIGN_ID}`);

console.log('');
console.log('============================================================');
console.log('VERIFIED CAMPAIGN STATE');
console.log('============================================================');
console.log(`  Status:           ${c.status}   ${c.status === 'schedule' ? '✓ SCHEDULED' : '⚠ NOT scheduled'}`);
console.log(`  Send time (UTC):  ${c.send_time}`);
console.log(`  Send time check:  ${c.send_time === SCHEDULE_UTC ? '✓ matches 9 AM Pacific' : '⚠ MISMATCH'}`);
console.log(`  Subject:          ${c.settings?.subject_line}`);
console.log(`  Preview text:     ${c.settings?.preview_text}`);
console.log(`  From name:        ${c.settings?.from_name}`);
console.log(`  Reply-to:         ${c.settings?.reply_to}`);
console.log(`  Audience ID:      ${c.recipients?.list_id}`);
console.log(`  Recipient count:  ${c.recipients?.recipient_count}`);
console.log('============================================================');

if (c.status === 'schedule' && c.send_time === SCHEDULE_UTC) {
  console.log('');
  console.log('✓✓✓ ALL CHECKS PASSED. Email will fire automatically at 9 AM Pacific.');
  console.log(`✓ ${c.recipients?.recipient_count} recipients will receive this email.`);
} else {
  console.log('');
  console.log('⚠ SOMETHING IS OFF — review above. Email may NOT send as expected.');
}
