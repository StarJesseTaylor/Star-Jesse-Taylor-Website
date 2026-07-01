#!/usr/bin/env node
/**
 * Accurate per-tag counts + identify three buckets:
 *   A. Workshop interest (the Online Workshop Aug 15)
 *   B. Community / What's Next interest
 *   C. Untagged + tagged-with-unrelated-things
 */
import fs from 'fs';
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function api(path) {
  const r = await fetch(`${ac.apiUrl}${path}`, { headers: { 'Api-Token': ac.apiKey } });
  return r.json();
}

// CANDIDATES (Star verifies)
const WORKSHOP_CANDIDATES = [
  { id: 23,  name: 'Virtual Event Interested' },
  { id: 50,  name: 'path:online-event' },
  { id: 52,  name: 'event:waitlist' },
  { id: 32,  name: 'LA Workshop Buyer (past May 30)' },
  { id: 34,  name: 'LA Workshop GA Buyer (past May 30)' },
];

const COMMUNITY_CANDIDATES = [
  { id: 139, name: 'source:whats-next' },
  { id: 142, name: 'interest:skool-community' },
  { id: 140, name: 'path:skool-public' },
  { id: 141, name: 'skool:waitlist' },
];

const TOTAL = (await api('/api/3/contacts?limit=1')).meta?.total || 0;
console.log(`TOTAL AC contacts: ${TOTAL}`);

// Correct way: /contacts?tagid=X returns contacts with that tag
async function countByTag(id) {
  const j = await api(`/api/3/contacts?tagid=${id}&limit=1`);
  return j.meta?.total ?? '?';
}

console.log('\n━━━ WORKSHOP-CANDIDATE TAGS ━━━');
const wsContactIds = new Set();
for (const t of WORKSHOP_CANDIDATES) {
  const n = await countByTag(t.id);
  console.log(`  [id ${t.id}] ${t.name.padEnd(45)} → ${n} contacts`);
  if (typeof n === 'number' && n > 0 && n < 500) {
    const j = await api(`/api/3/contacts?tagid=${t.id}&limit=500`);
    (j.contacts || []).forEach(c => wsContactIds.add(c.id));
  }
}
console.log(`  UNION of workshop-candidate tags: ${wsContactIds.size} unique contacts`);

console.log('\n━━━ COMMUNITY-CANDIDATE TAGS ━━━');
const commContactIds = new Set();
for (const t of COMMUNITY_CANDIDATES) {
  const n = await countByTag(t.id);
  console.log(`  [id ${t.id}] ${t.name.padEnd(45)} → ${n} contacts`);
  if (typeof n === 'number' && n > 0 && n < 500) {
    const j = await api(`/api/3/contacts?tagid=${t.id}&limit=500`);
    (j.contacts || []).forEach(c => commContactIds.add(c.id));
  }
}
console.log(`  UNION of community-candidate tags: ${commContactIds.size} unique contacts`);

console.log('\n━━━ OVERLAP + UNTAGGED CALCULATIONS ━━━');
const overlap = [...wsContactIds].filter(id => commContactIds.has(id));
console.log(`  contacts in BOTH workshop AND community: ${overlap.length}`);
console.log(`  workshop-only (not also community): ${wsContactIds.size - overlap.length}`);
console.log(`  community-only (not also workshop): ${commContactIds.size - overlap.length}`);

const tagged = new Set([...wsContactIds, ...commContactIds]);
const others = TOTAL - tagged.size;
console.log(`  contacts NEITHER workshop NOR community-candidate-tagged: ${others}`);
console.log(`  (these are the "untagged or tagged with other things" bucket)`);

console.log('\n━━━ ALSO worth checking ━━━');
const others_of_interest = [
  { id: 22,  name: 'Zoom RSVP May 5 2026' },
  { id: 35,  name: 'Zoom RSVP' },
  { id: 27,  name: 'Hot Lead' },
  { id: 29,  name: 'Lead Only' },
  { id: 12,  name: 'source:quiz' },
  { id: 39,  name: 'source:website' },
];
for (const t of others_of_interest) {
  const n = await countByTag(t.id);
  console.log(`  [id ${t.id}] ${t.name.padEnd(35)} → ${n} contacts`);
}
