#!/usr/bin/env node
/**
 * Create 2 draft campaigns in AC so Star can easily hit "Send test" in the UI.
 * One for community (msg 11), one for workshop (msg 12).
 */
import fs from 'fs';
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function createCampaign(name, messageId, segmentId) {
  const params = new URLSearchParams();
  params.append('type', 'single');
  params.append('name', name);
  params.append('sdate', '2026-06-30 09:00:00');
  params.append('status', '0');               // 0 = draft
  params.append('public', '0');
  params.append('tracklinks', 'all');
  params.append('trackreads', '1');
  params.append('p[3]', '3');                 // list ID 3
  params.append(`m[${messageId}]`, '100');    // 100% of recipients get this message
  params.append('segmentid', String(segmentId));

  const r = await fetch(`${ac.apiUrl}/admin/api.php?api_action=campaign_create&api_output=json`, {
    method: 'POST',
    headers: { 'Api-Token': ac.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { result_message: text.slice(0,250) }; }
  return { status: r.status, ...data };
}

console.log('━━━ Creating draft campaigns for easy test-send ━━━\n');

const c1 = await createCampaign('TEST_SEND — Community v17 (deliverability check)', 11, 11);
console.log(`Community campaign: ${c1.result_code === 1 ? '✓ id ' + c1.id : '✗ ' + c1.result_message}`);

const c2 = await createCampaign('TEST_SEND — Workshop v16 (deliverability check)', 12, 10);
console.log(`Workshop campaign:  ${c2.result_code === 1 ? '✓ id ' + c2.id : '✗ ' + c2.result_message}`);

if (c1.id) console.log(`\nCommunity edit URL:  https://starjessetaylor92181.activehosted.com/app/campaigns/${c1.id}/edit`);
if (c2.id) console.log(`Workshop edit URL:   https://starjessetaylor92181.activehosted.com/app/campaigns/${c2.id}/edit`);
console.log(`All campaigns list:  https://starjessetaylor92181.activehosted.com/app/campaigns/`);
