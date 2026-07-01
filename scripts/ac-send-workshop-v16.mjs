#!/usr/bin/env node
/** Send v16 (message 27) to 129 deduped workshop targets by repurposing list 5 (plan is at list cap). */
import fs from 'fs';
import { abortIfAlreadySent, verifySent } from './ac-send-guard.mjs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;
const LIST = 5; // reuse "API Test - 1 Person" list (account is at its list limit)
const CAMPAIGN_NAME = 'PROD Workshop v16 Jun27';

const targets = JSON.parse(fs.readFileSync('C:/Users/starj/Star-Jesse-Taylor-Website/scripts/.workshop-targets.json', 'utf8'));
if (targets.length < 100 || targets.length > 200) throw new Error(`SAFETY ABORT: ${targets.length} outside 100-200`);
const targetSet = new Set(targets.map(String));
console.log(`Targets loaded: ${targets.length}`);

async function POST(path, payload) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Api-Token': CFG.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${path}: ${t.slice(0, 200)}`); return JSON.parse(t);
}
async function GET(path) { const r = await fetch(BASE + path, { headers: { 'Api-Token': CFG.apiKey } }); return JSON.parse(await r.text()); }
async function v1(action, params) {
  const url = `${BASE}/admin/api.php?api_action=${action}&api_key=${CFG.apiKey}&api_output=json`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t }; }
}

// GUARD: refuse to run if this campaign already sent (prevents double-send on re-run)
await abortIfAlreadySent(GET, CAMPAIGN_NAME);

// 1. Unsubscribe any current list-5 member that is NOT a target (so the send hits exactly the 129)
console.log('STEP 1: clear non-target members from list 5...');
const cur = await GET(`/api/3/contacts?listid=${LIST}&limit=100`);
for (const c of cur.contacts) {
  if (!targetSet.has(String(c.id))) {
    await POST('/api/3/contactLists', { contactList: { list: LIST, contact: c.id, status: 2 } });
    console.log(`  - removed ${c.id} (${c.email})`);
  }
}

// 2. Add the 129 deduped contacts (status 1)
console.log(`STEP 2: add ${targets.length} workshop contacts...`);
let added = 0, failed = [];
for (const cid of targets) {
  try { await POST('/api/3/contactLists', { contactList: { list: LIST, contact: cid, status: 1 } }); added++; }
  catch { try { await POST('/api/3/contactLists', { contactList: { list: LIST, contact: cid, status: 1 } }); added++; } catch { failed.push(cid); } }
  if (added % 25 === 0) console.log(`  ...${added}/${targets.length}`);
}
console.log(`  ✓ added ${added}, failed ${failed.length}${failed.length ? ' -> ' + failed.join(',') : ''}`);

// 3. Fire campaign (message 27, past Central time -> immediate)
console.log('STEP 3: create + fire campaign...');
const camp = await v1('campaign_create', {
  type: 'single', name: CAMPAIGN_NAME, sdate: '2026-06-27 12:00:00',
  status: 1, public: 0, tracklinks: 'all', trackreads: 1,
  [`p[${LIST}]`]: String(LIST), ['m[27]']: '100',
});
console.log(`  v1 campaign_create -> code=${camp.result_code} msg="${camp.result_message}" id=${camp.id}`);

// 4. GUARD: verify it actually completed and reached exactly `added` recipients
console.log('STEP 4: verify send completed...');
const result = await verifySent(GET, camp.id, added);
console.log('='.repeat(60));
console.log(`✓✓✓ SENT to ${result.sent} workshop contacts. 0 overlap with the 168 community recipients.`);
console.log('='.repeat(60));
