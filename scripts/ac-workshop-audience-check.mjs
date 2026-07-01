#!/usr/bin/env node
/** READ-ONLY. Compute workshop audience, dedup against everyone who already got v17 (list 7). No sending. */
import fs from 'fs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;
async function GET(p) {
  const r = await fetch(BASE + p, { headers: { 'Api-Token': CFG.apiKey } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${p}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}
async function pageIds(makePath) {
  const ids = new Set(); let offset = 0;
  while (true) {
    const d = await GET(makePath(offset));
    for (const c of d.contacts) ids.add(c.id);
    if (!d.contacts || d.contacts.length < 100) break;
    offset += 100;
  }
  return ids;
}

const WORKSHOP_TAGS = [23, 52, 50, 35];
const workshop = new Set();
for (const t of WORKSHOP_TAGS) {
  const s = await pageIds(o => `/api/3/contacts?tagid=${t}&limit=100&offset=${o}`);
  console.log(`  tag ${t}: ${s.size} contacts`);
  for (const id of s) workshop.add(id);
}
console.log(`WORKSHOP union (tags 23/52/50/35): ${workshop.size}`);

const got17 = await pageIds(o => `/api/3/contacts?listid=7&limit=100&offset=${o}`);
console.log(`Already received v17 (list 7 members): ${got17.size}`);

const overlap = [...workshop].filter(id => got17.has(id));
const finalTargets = [...workshop].filter(id => !got17.has(id));
console.log('='.repeat(60));
console.log(`OVERLAP (people who'd be double-sent, will be EXCLUDED): ${overlap.length}`);
console.log(`FINAL workshop targets to send v16: ${finalTargets.length}`);
console.log('='.repeat(60));

const m = (await GET('/api/3/messages/27')).message;
console.log(`Message 27 subject: "${m.subject}"`);
console.log(`Message 27 from: ${m.fromname} <${m.fromemail}>`);
console.log(`Message 27 HTML length: ${(m.html || '').length} chars`);

fs.writeFileSync('C:/Users/starj/Star-Jesse-Taylor-Website/scripts/.workshop-targets.json',
  JSON.stringify(finalTargets), 'utf8');
console.log(`\nSaved ${finalTargets.length} target IDs to scripts/.workshop-targets.json`);
