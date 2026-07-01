#!/usr/bin/env node
/**
 * 1. Triple-check AC domain auth via API
 * 2. Verify DKIM/SPF/DMARC actually live in public DNS
 * 3. Push fresh MailChimp test (subject + sender verified)
 * 4. Send AC v1 test of message 11 (community) + message 12 (workshop)
 */
import fs from 'fs';
import { execSync } from 'child_process';

const mc = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const mcAuth = `Basic ${Buffer.from(`apikey:${mc.api_key}`).toString('base64')}`;
const TEST_TO = 'starjessetaylor@gmail.com';

console.log('━━━ 1. AC domain authentication status (API) ━━━');
const dkimRes = await fetch(`${ac.apiUrl}/api/3/dkim`, { headers: { 'Api-Token': ac.apiKey } });
const dkimJson = await dkimRes.json();
const ourDomain = (dkimJson.dkims || []).find(d => d.domain?.includes('starjessetaylor.com'));
if (ourDomain) {
  console.log(`  domain:           ${ourDomain.domain}`);
  console.log(`  authenticated:    ${ourDomain.authenticate || ourDomain.authentication_state}`);
  console.log(`  verified:         ${ourDomain.verify || ourDomain.verification_state}`);
} else {
  console.log(`  (no DKIM entry found yet — raw response:)`);
  console.log(`  ${JSON.stringify(dkimJson).slice(0, 400)}`);
}

console.log('\n━━━ 2. Public DNS state ━━━');
function dig(name, type) {
  try {
    return execSync(`nslookup -type=${type} ${name} 8.8.8.8 2>&1`, { encoding: 'utf8' });
  } catch (e) { return e.message; }
}
const spf = dig('starjessetaylor.com', 'TXT');
const dmarc = dig('_dmarc.starjessetaylor.com', 'TXT');
console.log('  SPF root:');
(spf.match(/"v=spf1[^"]*"/g) || ['  (not found)']).forEach(l => console.log(`    ${l}`));
console.log('  DMARC:');
(dmarc.match(/"v=DMARC1[^"]*"/g) || ['  (not found)']).forEach(l => console.log(`    ${l}`));

console.log('\n━━━ 3. MailChimp test send ━━━');
const mcCamp = await fetch(`https://${mc.server}.api.mailchimp.com/3.0/campaigns/434148f526`, { headers: { Authorization: mcAuth } });
const mcC = await mcCamp.json();
console.log(`  campaign status: ${mcC.status}  from_name="${mcC.settings.from_name}"  reply_to=${mcC.settings.reply_to}`);
console.log(`  subject: "${mcC.settings.subject_line}"`);
// Push fresh HTML before test
const html = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');
await fetch(`https://${mc.server}.api.mailchimp.com/3.0/campaigns/434148f526/content`, {
  method: 'PUT',
  headers: { Authorization: mcAuth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ html }),
});
const mcTest = await fetch(`https://${mc.server}.api.mailchimp.com/3.0/campaigns/434148f526/actions/test`, {
  method: 'POST',
  headers: { Authorization: mcAuth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ test_emails: [TEST_TO], send_type: 'html' }),
});
console.log(`  MC test send: ${mcTest.status} ${mcTest.ok ? '✓ SENT' : (await mcTest.text()).slice(0,200)}`);

console.log('\n━━━ 4. ActiveCampaign test sends ━━━');
async function acTest(messageId, label) {
  const params = new URLSearchParams();
  params.append('email', TEST_TO);
  params.append('messageid', messageId);
  params.append('campaignid', '0');
  params.append('action', 'test');
  params.append('type', 'html');
  const r = await fetch(`${ac.apiUrl}/admin/api.php?api_action=campaign_send&api_output=json`, {
    method: 'POST',
    headers: { 'Api-Token': ac.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const text = await r.text();
  console.log(`  msg ${messageId} (${label}): status=${r.status}`);
  console.log(`    body: ${text.slice(0, 250)}`);
}
await acTest(11, 'Community v17');
await acTest(12, 'Workshop v16');

console.log('\n━━━ Done ━━━');
