#!/usr/bin/env node
/**
 * AC v1 campaign_create with CORRECT auth: API-TOKEN header (not query string)
 */
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

const URL = `${CONFIG.apiUrl}/admin/api.php?api_action=campaign_create&api_output=json`;

const params = new URLSearchParams();
params.append('type', 'single');
params.append('name', 'API TEST CORRECT AUTH ' + Date.now());
params.append('sdate', '2026-06-28 13:00:00');
params.append('status', '0');
params.append('public', '0');
params.append('tracklinks', 'all');
params.append('trackreads', '1');
params.append('p[3]', '3');     // list ID 3
params.append('m[11]', '100');  // message ID 11
params.append('segmentid', '11'); // community segment

const res = await fetch(URL, {
  method: 'POST',
  headers: {
    'Api-Token': CONFIG.apiKey,         // ← CORRECT auth method
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: params,
});

console.log(`status: ${res.status}`);
console.log(`headers:`);
for (const [k, v] of res.headers) console.log(`  ${k}: ${v}`);
const text = await res.text();
console.log(`body length: ${text.length}`);
console.log(`body: ${text.slice(0, 2000)}`);
