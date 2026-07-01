#!/usr/bin/env node
/**
 * Try AC v3 API for campaign creation.
 * Test campaign creation; if it succeeds, full send + schedule script follows.
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const URL = CONFIG.apiUrl;
const HEADERS = { 'Api-Token': CONFIG.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };

async function ac(path, options = {}) {
  const res = await fetch(`${URL}/api/3${path}`, { ...options, headers: { ...HEADERS, ...(options.headers || {}) } });
  const text = await res.text();
  console.log(`${options.method || 'GET'} ${path} → ${res.status}`);
  if (!res.ok) console.log(`  body: ${text.slice(0, 400)}`);
  return { ok: res.ok, status: res.status, body: text ? (text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : text) : null };
}

// Test 1: list lists
console.log('=== TEST 1: List lists ===');
const lists = await ac('/lists?limit=10');
if (lists.ok) {
  for (const l of (lists.body.lists || [])) {
    console.log(`  list ${l.id}: "${l.name}"`);
  }
}

// Test 2: try to GET existing campaigns (to see field format)
console.log('\n=== TEST 2: GET existing campaigns ===');
const campaigns = await ac('/campaigns?limit=3');
if (campaigns.ok) {
  console.log(`  found ${(campaigns.body.campaigns || []).length} existing campaigns`);
  if ((campaigns.body.campaigns || []).length > 0) {
    const sample = campaigns.body.campaigns[0];
    console.log(`  sample fields: ${Object.keys(sample).join(', ')}`);
  }
}

// Test 3: try to create a draft campaign
console.log('\n=== TEST 3: Try creating draft campaign ===');
const createPayload = {
  campaign: {
    type: 'single',
    name: 'TEST workshop email v16 — DELETE ME',
    sdate: '2026-06-28 09:00:00', // 9 AM (timezone-dependent)
    status: 0, // draft
    public: 0,
    track_links: 'all',
    track_reads: 1,
    track_replies: 1,
  },
};
const create = await ac('/campaigns', { method: 'POST', body: JSON.stringify(createPayload) });
if (create.ok) {
  console.log(`  ✓ Campaign created! ID: ${create.body.campaign?.id}`);
} else {
  console.log(`  ✗ Creation failed`);
}
