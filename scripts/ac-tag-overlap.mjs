#!/usr/bin/env node
/**
 * Pull actual contact IDs per tag, compute true overlaps.
 * Answers:
 *  Q1: Are the 4 "community" tags the same 41 people?
 *  Q2: Are the 3 "workshop" tags all online-event interested?
 *      Is event:waitlist (64) a superset that includes in-person/other-city?
 */
import fs from 'fs';
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function api(path) {
  const r = await fetch(`${ac.apiUrl}${path}`, { headers: { 'Api-Token': ac.apiKey } });
  return r.json();
}

async function contactIdsForTag(tagId) {
  const ids = new Set();
  let offset = 0;
  while (true) {
    const j = await api(`/api/3/contacts?tagid=${tagId}&limit=100&offset=${offset}`);
    const batch = j.contacts || [];
    if (!batch.length) break;
    batch.forEach(c => ids.add(c.id));
    if (batch.length < 100) break;
    offset += 100;
  }
  return ids;
}

console.log('━━━ COMMUNITY TAGS — are the 4 the same 41 people? ━━━');
const community = [
  { id: 139, name: 'source:whats-next' },
  { id: 142, name: 'interest:skool-community' },
  { id: 140, name: 'path:skool-public' },
  { id: 141, name: 'skool:waitlist' },
];
const commSets = {};
for (const t of community) {
  commSets[t.id] = await contactIdsForTag(t.id);
  console.log(`  [${t.id}] ${t.name.padEnd(30)} → ${commSets[t.id].size} contacts`);
}
const allComm = new Set();
Object.values(commSets).forEach(s => s.forEach(id => allComm.add(id)));
const inAllFour = [...commSets[community[0].id]].filter(id =>
  community.slice(1).every(t => commSets[t.id].has(id))
);
console.log(`  UNION across all 4 tags: ${allComm.size}`);
console.log(`  INTERSECTION (in all 4): ${inAllFour.length}`);
console.log(`  → ${allComm.size === inAllFour.length ? 'YES, all 4 tags = the same people' : 'NO, different overlap'}`);

console.log('\n━━━ WORKSHOP TAGS — are the 3 the same people? ━━━');
const workshop = [
  { id: 23,  name: 'Virtual Event Interested' },
  { id: 50,  name: 'path:online-event' },
  { id: 52,  name: 'event:waitlist' },
];
const wsSets = {};
for (const t of workshop) {
  wsSets[t.id] = await contactIdsForTag(t.id);
  console.log(`  [${t.id}] ${t.name.padEnd(30)} → ${wsSets[t.id].size} contacts`);
}
const allWs = new Set();
Object.values(wsSets).forEach(s => s.forEach(id => allWs.add(id)));
console.log(`  UNION across all 3 tags: ${allWs.size} unique contacts`);
console.log('');
console.log('  PAIRWISE OVERLAP:');
console.log(`    Virtual Event Interested ∩ path:online-event = ${[...wsSets[23]].filter(id => wsSets[50].has(id)).length}`);
console.log(`    Virtual Event Interested ∩ event:waitlist    = ${[...wsSets[23]].filter(id => wsSets[52].has(id)).length}`);
console.log(`    path:online-event        ∩ event:waitlist    = ${[...wsSets[50]].filter(id => wsSets[52].has(id)).length}`);
console.log('');
console.log('  IS event:waitlist a superset of online-event?');
const inWaitlistButNotOnlineEvent = [...wsSets[52]].filter(id => !wsSets[50].has(id));
console.log(`    contacts in event:waitlist but NOT in path:online-event: ${inWaitlistButNotOnlineEvent.length}`);
console.log(`    → these are likely the OTHER-CITY waitlist contacts (in-person tour interest)`);
console.log('');
console.log('  IS event:waitlist a superset of Virtual Event Interested?');
const inWaitlistButNotVirtual = [...wsSets[52]].filter(id => !wsSets[23].has(id));
console.log(`    contacts in event:waitlist but NOT in Virtual Event Interested: ${inWaitlistButNotVirtual.length}`);

console.log('\n━━━ COMM ∩ WORKSHOP overlap ━━━');
const overlap = [...allComm].filter(id => allWs.has(id));
console.log(`  contacts tagged BOTH community AND workshop: ${overlap.length}`);
