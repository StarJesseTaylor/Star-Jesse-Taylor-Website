#!/usr/bin/env node
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const HEADERS = { 'Api-Token': CONFIG.apiKey, Accept: 'application/json' };

async function ac(path) {
  const res = await fetch(`${CONFIG.apiUrl}/api/3${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

// Pull ALL contacts (paginate)
async function allContacts() {
  const all = [];
  let offset = 0;
  while (true) {
    const r = await ac(`/contacts?limit=100&offset=${offset}`);
    const batch = r.contacts || [];
    all.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
    if (offset > 1000) break; // safety
  }
  return all;
}

// Pull contacts for a tag
async function contactsForTag(tagId) {
  const all = [];
  let offset = 0;
  while (true) {
    const r = await ac(`/contactTags?filters[tag]=${tagId}&limit=100&offset=${offset}`);
    const batch = r.contactTags || [];
    all.push(...batch.map(ct => ct.contact));
    if (batch.length < 100) break;
    offset += 100;
    if (offset > 1000) break;
  }
  return new Set(all);
}

console.log('Pulling all AC contacts...');
const contacts = await allContacts();
console.log(`Total AC contacts: ${contacts.length}`);
console.log();

// Workshop tag IDs from earlier query
const WORKSHOP_TAG_IDS = [
  23,  // Virtual Event Interested (116)
  52,  // event:waitlist (64)
  50,  // path:online-event (62)
  35,  // Zoom RSVP (84)
];

const COMMUNITY_TAG_IDS = [
  141, // skool:waitlist (35)
];

console.log('Pulling workshop-tagged contacts...');
const workshopSet = new Set();
for (const id of WORKSHOP_TAG_IDS) {
  const s = await contactsForTag(id);
  console.log(`  tag ${id}: ${s.size} contacts`);
  for (const c of s) workshopSet.add(c);
}
console.log(`Workshop UNIQUE union: ${workshopSet.size}`);
console.log();

console.log('Pulling community-tagged contacts...');
const communitySet = new Set();
for (const id of COMMUNITY_TAG_IDS) {
  const s = await contactsForTag(id);
  console.log(`  tag ${id}: ${s.size} contacts`);
  for (const c of s) communitySet.add(c);
}
console.log(`Community UNIQUE: ${communitySet.size}`);
console.log();

// Overlap?
let overlap = 0;
for (const c of communitySet) if (workshopSet.has(c)) overlap++;
console.log(`Workshop ∩ Community overlap: ${overlap} contacts`);
console.log();

// Untagged = total - (workshop ∪ community)
const tagged = new Set([...workshopSet, ...communitySet]);
const taggedCount = tagged.size;
console.log(`Total tagged (workshop ∪ community): ${taggedCount}`);
console.log(`UNTAGGED (in AC but not in workshop or community segments): ${contacts.length - taggedCount}`);
console.log();

console.log('============================================================');
console.log('SEND SEGMENTATION:');
console.log('============================================================');
console.log(`  Workshop email (v16):       ${workshopSet.size} contacts`);
console.log(`  Community email (v17) AC:`);
console.log(`    - skool:waitlist:          ${communitySet.size} contacts`);
console.log(`    - untagged AC:             ${contacts.length - taggedCount} contacts`);
console.log(`    - total AC community:      ${communitySet.size + contacts.length - taggedCount} contacts`);
console.log(`  Community email (v17) MC:   2009 contacts`);
console.log(`  GRAND TOTAL UNIQUE TOUCH:    ~${workshopSet.size + communitySet.size + (contacts.length - taggedCount) + 2009} (some overlap with MC likely)`);
