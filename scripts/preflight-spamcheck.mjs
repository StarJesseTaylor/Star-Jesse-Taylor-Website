#!/usr/bin/env node
/**
 * Pre-flight spam check using Postmark's FREE SpamAssassin-based API.
 * Run this on any HTML email BEFORE pushing to MC/AC.
 *
 * Usage:
 *   node scripts/preflight-spamcheck.mjs <path-to-html-file>
 *
 * Score:
 *   8.0+  = green light, ship it
 *   6-8   = yellow, review issues
 *   <6    = red, fix before sending
 *
 * Postmark's API is rate-limited but FREE. No signup needed.
 * Docs: https://spamcheck.postmarkapp.com/
 */
import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node preflight-spamcheck.mjs <path-to-html-file>');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const html = fs.readFileSync(file, 'utf8');

// Build a minimal RFC822 email message wrapping the HTML
const message = [
  'From: star@starjessetaylor.com',
  'To: test@example.com',
  'Subject: Test for deliverability check',
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  '',
  html,
].join('\r\n');

console.log(`━━━ Pre-flight spam check: ${path.basename(file)} ━━━\n`);
console.log(`Sending to Postmark spamcheck API...`);

const res = await fetch('https://spamcheck.postmarkapp.com/filter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({
    email: message,
    options: 'long',
  }),
});

if (!res.ok) {
  console.error(`✗ API error: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const result = await res.json();
const score = parseFloat(result.score);

console.log(`\n━━━ SCORE: ${score} ━━━`);
if (score >= 8) console.log('🟢 GREEN. Ship it.');
else if (score >= 6) console.log('🟡 YELLOW. Review issues below.');
else console.log('🔴 RED. Fix before sending.');

console.log(`\nRules triggered:\n${result.report}`);

// Exit code: 0 if green, 1 if anything below 8
process.exit(score >= 8 ? 0 : 1);
