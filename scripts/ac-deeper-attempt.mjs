#!/usr/bin/env node
/**
 * Deeper attempt at AC campaign creation. Multiple approaches.
 */
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const v3 = `${CONFIG.apiUrl}/api/3`;
const H = { 'Api-Token': CONFIG.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

async function tryEndpoint(method, path, body, label) {
  const res = await fetch(`${v3}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  console.log(`\n[${label}]`);
  console.log(`  ${method} ${path} → ${res.status}`);
  if (!res.ok) console.log(`  body: ${text.slice(0, 500)}`);
  else console.log(`  ✓ OK (id: ${text.includes('"id"') ? JSON.parse(text).campaign?.id || JSON.parse(text).id : '?'})`);
  return { ok: res.ok, status: res.status, body: text };
}

// Approach 1: Get account info to check tier
console.log('=== ACCOUNT INFO ===');
await tryEndpoint('GET', '/account', null, 'GET account');

// Approach 2: List campaign types available
console.log('\n=== AVAILABLE CAMPAIGN APIs ===');
await tryEndpoint('GET', '/campaigns?limit=1', null, 'GET campaigns');
await tryEndpoint('OPTIONS', '/campaigns', null, 'OPTIONS campaigns');

// Approach 3: POST with FULL payload from a real campaign we can see
console.log('\n=== POST CAMPAIGNS — FULL PAYLOAD ===');
const fullPayload = {
  campaign: {
    type: 'single',
    name: 'API TEST DELETE ME ' + Date.now(),
    sdate: '2026-06-28 09:00:00',
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
    embed_images: 1,
  }
};
await tryEndpoint('POST', '/campaigns', fullPayload, 'POST campaign with full body');

// Approach 4: Try newer "send a draft" or "schedule" endpoints
console.log('\n=== ALTERNATIVE ENDPOINTS ===');
await tryEndpoint('GET', '/automations?limit=3', null, 'GET automations');
await tryEndpoint('GET', '/campaignLinks', null, 'GET campaignLinks');
await tryEndpoint('GET', '/campaignMessages', null, 'GET campaignMessages');

// Approach 5: maybe campaigns are sent via batch
await tryEndpoint('POST', '/campaign-messages', { campaignMessage: { campaign: 1, message: 11 } }, 'POST campaign-messages link');
