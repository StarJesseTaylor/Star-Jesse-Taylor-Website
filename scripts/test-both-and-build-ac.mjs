#!/usr/bin/env node
/**
 * 1. Send v17 test (community) — uses current campaign HTML
 * 2. Unschedule campaign, swap v16 in, send v16 test, swap v17 back, leave UNSCHEDULED
 * 3. Create v17 + v16 AC messages via v3 API
 */
import fs from 'fs';

const MC_CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const AC_CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

const MC_BASE = `https://${MC_CONFIG.server}.api.mailchimp.com/3.0`;
const MC_AUTH = `Basic ${Buffer.from(`apikey:${MC_CONFIG.api_key}`).toString('base64')}`;
const CAMPAIGN_ID = '434148f526';
const TEST_EMAIL = 'starjessetaylor@gmail.com';
const HTML_V17 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');
const HTML_V16 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-LATEST.html', 'utf8');

const v3 = `${AC_CONFIG.apiUrl}/api/3`;
const ACH = { 'Api-Token': AC_CONFIG.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

const SUBJECT = 'Are you tired of constantly fighting with your brain?';
const PREHEADER = "Why you can't stop fighting your brain, and what to do instead.";
const FROM_NAME = 'Star Jesse Taylor';
const FROM_EMAIL = 'starjessetaylor@gmail.com';

async function mc(path, options = {}) {
  const res = await fetch(`${MC_BASE}${path}`, { ...options, headers: { Authorization: MC_AUTH, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const t = await res.text();
  if (!res.ok) { console.error(`MC ${res.status}: ${t.slice(0, 300)}`); throw new Error(`failed ${path}`); }
  return t ? JSON.parse(t) : {};
}
async function mcQuiet(path, options = {}) {
  const res = await fetch(`${MC_BASE}${path}`, { ...options, headers: { Authorization: MC_AUTH, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

// STEP 1: unschedule first (so swaps don't risk firing the actual send)
console.log('STEP 1: Unschedule campaign (safety) ...');
const unsched = await mcQuiet(`/campaigns/${CAMPAIGN_ID}/actions/unschedule`, { method: 'POST' });
console.log(`  ${unsched.ok ? '✓ Unscheduled' : '(already not scheduled)'}`);

// STEP 2: Send v17 test (it's already in campaign right now)
console.log('\nSTEP 2: Confirm v17 HTML in campaign + send test ...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, { method: 'PUT', body: JSON.stringify({ html: HTML_V17 }) });
await mc(`/campaigns/${CAMPAIGN_ID}`, { method: 'PATCH', body: JSON.stringify({ settings: { subject_line: `[TEST v17 COMMUNITY] ${SUBJECT}` } }) });
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, { method: 'POST', body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }) });
console.log('  ✓ v17 COMMUNITY test sent');

// STEP 3: Swap to v16, send test, swap back
console.log('\nSTEP 3: Push v16 + send test ...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, { method: 'PUT', body: JSON.stringify({ html: HTML_V16 }) });
await mc(`/campaigns/${CAMPAIGN_ID}`, { method: 'PATCH', body: JSON.stringify({ settings: { subject_line: `[TEST v16 WORKSHOP] ${SUBJECT}` } }) });
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, { method: 'POST', body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }) });
console.log('  ✓ v16 WORKSHOP test sent');

// STEP 4: Restore v17 to campaign (so it's ready for real send when Star approves)
console.log('\nSTEP 4: Restore v17 to campaign + clean subject (real-send-ready) ...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, { method: 'PUT', body: JSON.stringify({ html: HTML_V17 }) });
await mc(`/campaigns/${CAMPAIGN_ID}`, { method: 'PATCH', body: JSON.stringify({ settings: { subject_line: SUBJECT, preview_text: PREHEADER } }) });
console.log('  ✓ v17 restored, clean subject (no [TEST])');
console.log('  ✓ Campaign UNSCHEDULED (save state) — awaiting Star "send" command');

// STEP 5: Create AC messages for both
console.log('\nSTEP 5: Build AC messages ...');
async function createAcMessage(html, label) {
  const body = JSON.stringify({
    message: {
      subject: SUBJECT,
      preheader_text: PREHEADER,
      fromname: FROM_NAME,
      fromemail: FROM_EMAIL,
      reply2: FROM_EMAIL,
      format: 'mime',
      charset: 'utf-8',
      encoding: '7bit',
      html: html,
      text: 'View this email in HTML.',
      userid: 1,
      ed_instanceid: 1,
      ed_version: 2,
    }
  });
  const r = await fetch(`${v3}/messages`, { method: 'POST', headers: ACH, body });
  if (!r.ok) { console.error(`  ✗ AC msg ${label}: ${r.status} ${await r.text()}`); return null; }
  const j = JSON.parse(await r.text());
  console.log(`  ✓ ${label}: message id ${j.message?.id}`);
  return j.message.id;
}
const acMsgV17 = await createAcMessage(HTML_V17, 'v17 COMMUNITY (for AC community segment)');
const acMsgV16 = await createAcMessage(HTML_V16, 'v16 WORKSHOP (for AC workshop segment)');

console.log('\n============================================================');
console.log('READY STATE');
console.log('============================================================');
console.log('  ✓ Two test emails in your inbox (v17 + v16)');
console.log('  ✓ MailChimp campaign: v17 loaded, UNSCHEDULED — awaiting your "send" command');
console.log(`  ✓ AC message ${acMsgV17}: v17 COMMUNITY ready (pair with segment 11)`);
console.log(`  ✓ AC message ${acMsgV16}: v16 WORKSHOP  ready (pair with segment 10)`);
console.log('============================================================');
console.log('\nWhen you say "send everything":');
console.log('  1. I reschedule MailChimp for [your chosen time]');
console.log('  2. You open AC → New Campaign → use existing message → pick segment → schedule');
