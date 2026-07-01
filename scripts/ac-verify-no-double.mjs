#!/usr/bin/env node
/** READ-ONLY. Prove no double-send: compare actual recipients of the workshop send (list 5)
 *  vs the community send (list 7), by EMAIL ADDRESS. Also locate all of Star's addresses. */
import fs from 'fs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;
async function GET(p) { const r = await fetch(BASE + p, { headers: { 'Api-Token': CFG.apiKey } }); return JSON.parse(await r.text()); }

// active (status 1) members of a list -> [{id,email}]
async function listMembers(listId) {
  const out = []; let offset = 0;
  while (true) {
    const d = await GET(`/api/3/contacts?listid=${listId}&status=1&limit=100&offset=${offset}`);
    for (const c of d.contacts) out.push({ id: c.id, email: (c.email || '').toLowerCase() });
    if (!d.contacts || d.contacts.length < 100) break;
    offset += 100;
  }
  return out;
}

const workshop = await listMembers(5);  // campaign #21 v16
const community = await listMembers(7);  // campaign #20 v17
console.log(`Workshop send (list 5): ${workshop.length} active recipients`);
console.log(`Community send (list 7): ${community.length} active recipients`);

// 1. duplicate emails WITHIN each send (same address twice)
const dup = (arr, label) => {
  const seen = new Set(), dups = new Set();
  for (const c of arr) { if (seen.has(c.email)) dups.add(c.email); seen.add(c.email); }
  console.log(`Duplicate addresses within ${label}: ${dups.size}${dups.size ? ' -> ' + [...dups].join(', ') : ''}`);
};
dup(workshop, 'workshop'); dup(community, 'community');

// 2. addresses that got BOTH emails (overlap by email string)
const wEmails = new Set(workshop.map(c => c.email));
const both = community.filter(c => wEmails.has(c.email)).map(c => c.email);
console.log('='.repeat(60));
console.log(`Addresses that received BOTH workshop AND community: ${both.length}`);
if (both.length) console.log('  -> ' + both.join('\n  -> '));
console.log('='.repeat(60));

// 3. locate Star's own addresses across BOTH sends + flag the test campaigns
const isStar = e => /starjessetaylor|jessetaylor|jesse.*taylor|traxxx/i.test(e);
const starW = workshop.filter(c => isStar(c.email));
const starC = community.filter(c => isStar(c.email));
console.log(`Star-looking addresses in WORKSHOP send (${starW.length}): ${starW.map(c => c.email).join(', ') || '(none)'}`);
console.log(`Star-looking addresses in COMMUNITY send (${starC.length}): ${starC.map(c => c.email).join(', ') || '(none)'}`);
