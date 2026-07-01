#!/usr/bin/env node
/** Read-only: list recent AC campaigns with real send status. */
import fs from 'fs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;

async function GET(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Api-Token': CFG.apiKey } });
  const text = await res.text();
  if (!res.ok) { console.error(`AC ${res.status} on ${path}: ${text.slice(0, 300)}`); throw new Error('failed'); }
  return JSON.parse(text);
}

// status: 0 draft, 1 scheduled, 2 sending, 3 paused, 4 stopped, 5 completed, 6 disabled
const STATUS = { 0: 'draft', 1: 'scheduled', 2: 'sending', 3: 'paused', 4: 'stopped', 5: 'COMPLETED', 6: 'disabled' };

const data = await GET('/api/3/campaigns?orders[sdate]=DESC&limit=25');
console.log(`Total campaigns in account: ${data.meta?.total}`);
console.log('='.repeat(96));
for (const c of data.campaigns) {
  console.log(
    `#${c.id}  [${(STATUS[c.status] || c.status).padEnd(9)}]  ` +
    `sent=${String(c.send_amt).padStart(4)}  ` +
    `sdate=${c.sdate || '—'}  ldate=${c.ldate || '—'}`
  );
  console.log(`        name: ${c.name}`);
}
