#!/usr/bin/env node
/**
 * Push HTML to MailChimp campaign + send test email.
 * Usage: node scripts/push-and-test-email.mjs <local-html-path> <subject-label>
 */
import fs from 'fs';

const localPath = process.argv[2];
const label = process.argv[3] || 'TEST';

if (!localPath || !fs.existsSync(localPath)) {
  console.error('Usage: node push-and-test-email.mjs <html-path> <label>');
  process.exit(1);
}

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const BASE = `https://${CONFIG.server}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';
const TEST_EMAIL = 'starjessetaylor@gmail.com';
const AUTH = `Basic ${Buffer.from(`apikey:${CONFIG.api_key}`).toString('base64')}`;

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MC API ${res.status}: ${text.slice(0, 300)}`); throw new Error(`API failed: ${path}`); }
  return text ? JSON.parse(text) : {};
}

const html = fs.readFileSync(localPath, 'utf8');
console.log(`Pushing ${localPath} (${html.length} chars) to campaign ${CAMPAIGN_ID}...`);

await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html }),
});
console.log(`✓ HTML pushed`);

// Update subject so Star can tell them apart in inbox
const subject = `[TEST ${label}] Tired of seeing everybody else live carefree?`;
await mc(`/campaigns/${CAMPAIGN_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ settings: { subject_line: subject, preview_text: `${label} version — preview of community-led/workshop-led variant` } }),
});
console.log(`✓ Subject updated to: ${subject}`);

console.log(`Sending test to ${TEST_EMAIL}...`);
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }),
});
console.log(`✓ Test email sent to ${TEST_EMAIL}`);
