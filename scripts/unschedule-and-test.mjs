#!/usr/bin/env node
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const BASE = `https://${CONFIG.server}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';
const AUTH = `Basic ${Buffer.from(`apikey:${CONFIG.api_key}`).toString('base64')}`;
const TEST_EMAIL = 'starjessetaylor@gmail.com';

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...options.headers } });
  const text = await res.text();
  if (!res.ok) { console.error(`MC ${res.status}: ${text.slice(0, 300)}`); throw new Error(`failed ${path}`); }
  return text ? JSON.parse(text) : {};
}

console.log('STEP 1: Unschedule campaign...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/unschedule`, { method: 'POST' });
console.log('  ✓ Unscheduled (status reverted to save)');

console.log('STEP 2: Send fresh test...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }),
});
console.log(`  ✓ Test sent to ${TEST_EMAIL}`);

console.log('STEP 3: Verify state...');
const c = await mc(`/campaigns/${CAMPAIGN_ID}`);
console.log(`  Status: ${c.status} (should be "save" — ready for re-schedule)`);
console.log(`  Subject: ${c.settings?.subject_line}`);
console.log('');
console.log('Campaign is UNSCHEDULED. Test sent. When Star approves, re-run schedule-and-verify.mjs.');
