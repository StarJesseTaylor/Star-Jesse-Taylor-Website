#!/usr/bin/env node
/**
 * Per the discovery: POST /campaigns IS allowed. Validation must be failing.
 * Try with required addressid (from-address ID).
 */
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const v3 = `${CONFIG.apiUrl}/api/3`;
const H = { 'Api-Token': CONFIG.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

// First find the from-address ID (needed for campaign)
console.log('Getting addresses...');
let res = await fetch(`${v3}/addresses`, { headers: H });
let json = await res.json();
console.log(`  found ${json.addresses?.length || 0} addresses`);
for (const a of (json.addresses || [])) {
  console.log(`  id ${a.id}: ${a.name} <${a.address}>`);
}
const addressId = json.addresses?.[0]?.id;
console.log(`  using addressId: ${addressId}`);

// Get a sample existing campaign for required field reference
console.log('\nGetting sample campaign for field reference...');
res = await fetch(`${v3}/campaigns?limit=1`, { headers: H });
json = await res.json();
const sample = json.campaigns?.[0];
console.log(`  sample status: ${sample?.status}, type: ${sample?.type}, name: ${sample?.name}`);
console.log(`  sample addressid: ${sample?.addressid}, source: ${sample?.source}`);

// Try POST with addressid + source + minimal viable payload
console.log('\nAttempt: POST with full required fields including addressid...');
const payload = {
  campaign: {
    type: 'single',
    name: 'API TEST DELETE ME ' + Date.now(),
    sdate: '2026-06-28 13:00:00',
    status: 0,
    public: 0,
    track_links: 'all',
    track_reads: 1,
    track_replies: 1,
    htmlconstructor: 'editor',
    textconstructor: 'editor',
    messageid: 11,
    listid: 3,
    segmentid: 11,
    addressid: addressId,
    source: 'manual',
    embed_images: 1,
    can_skip_approval: 1,
  }
};
res = await fetch(`${v3}/campaigns`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
const text = await res.text();
console.log(`  POST /campaigns → ${res.status}`);
console.log(`  response: ${text.slice(0, 1500)}`);
