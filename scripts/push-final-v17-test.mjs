#!/usr/bin/env node
/**
 * Push FINAL v17 to MailChimp with clean subject + send test.
 * The subject in this push is the EXACT subject that would go out on the real send.
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const BASE = `https://${CONFIG.server}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';
const TEST_EMAIL = 'starjessetaylor@gmail.com';
const AUTH = `Basic ${Buffer.from(`apikey:${CONFIG.api_key}`).toString('base64')}`;

const html = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');

const REAL_SUBJECT = 'Are you tired of constantly fighting with your brain?';
const PREVIEW_TEXT = 'Why you can\'t stop fighting your brain, and what to do instead.';

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MC ${res.status}: ${text.slice(0, 300)}`); throw new Error(`failed ${path}`); }
  return text ? JSON.parse(text) : {};
}

console.log(`Pushing v17-FINAL (${html.length} chars) to campaign...`);
await mc(`/campaigns/${CAMPAIGN_ID}/content`, { method: 'PUT', body: JSON.stringify({ html }) });
console.log(`✓ HTML pushed`);

console.log(`Setting subject + preview text (these are the REAL values, no [TEST] prefix)...`);
await mc(`/campaigns/${CAMPAIGN_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ settings: { subject_line: REAL_SUBJECT, preview_text: PREVIEW_TEXT } }),
});
console.log(`✓ Subject: ${REAL_SUBJECT}`);
console.log(`✓ Preview: ${PREVIEW_TEXT}`);

console.log(`Sending test to ${TEST_EMAIL}...`);
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }),
});
console.log(`✓ TEST EMAIL SENT — check inbox`);
console.log(``);
console.log(`When sent for real, the subject in the recipient's inbox is:`);
console.log(`  → "${REAL_SUBJECT}"`);
console.log(`No [TEST] prefix on the real send.`);
