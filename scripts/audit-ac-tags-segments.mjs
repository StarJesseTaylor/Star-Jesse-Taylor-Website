#!/usr/bin/env node
/**
 * Comprehensive AC tag audit:
 * - List ALL tags with contact counts
 * - Classify each tag: WORKSHOP / COMMUNITY / OTHER / UNTAGGED
 * - Show total contacts in each segment + un-segmented
 * - Identify the "What's Next" tag specifically
 */
import fs from 'fs';
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function api(path) {
  const r = await fetch(`${ac.apiUrl}${path}`, { headers: { 'Api-Token': ac.apiKey } });
  return r.json();
}

console.log('━━━ ALL TAGS ━━━');
let offset = 0;
const allTags = [];
while (true) {
  const j = await api(`/api/3/tags?limit=100&offset=${offset}`);
  if (!j.tags?.length) break;
  allTags.push(...j.tags);
  if (j.tags.length < 100) break;
  offset += 100;
}
console.log(`Total tags: ${allTags.length}\n`);

// Sort by id for consistent display
allTags.sort((a, b) => parseInt(a.id) - parseInt(b.id));

// Quick classifier (heuristic, Star will verify)
function classify(name) {
  const n = name.toLowerCase();
  if (n.includes('workshop') || n.includes('confidence') || n.includes('anxiety to') || n.includes('la event')) return 'WORKSHOP';
  if (n.includes('community') || n.includes('inner circle') || n.includes('what') || n.includes('next')) return 'COMMUNITY/NEXT';
  if (n.includes('course') || n.includes('1on1') || n.includes('coaching') || n.includes('book') || n.includes('quiz')) return 'OTHER';
  return '?';
}

console.log('id    | classify          | name                                              | contacts');
console.log('------|-------------------|---------------------------------------------------|--------');
for (const t of allTags) {
  // Get contact count for this tag
  const cj = await api(`/api/3/contactTags?filters[tag]=${t.id}&limit=1`);
  const count = cj.meta?.total || '?';
  const tag = String(t.tag).padEnd(50);
  const klass = classify(t.tag).padEnd(18);
  console.log(`${String(t.id).padEnd(5)} | ${klass} | ${tag.slice(0,49)} | ${count}`);
}

console.log('\n━━━ EXISTING SEGMENTS (created earlier this session) ━━━');
const segs = await api('/api/3/segments?limit=50');
for (const s of (segs.segments || [])) {
  console.log(`  [seg ${s.id}] "${s.name}"  ${s.rules || ''}`);
}

console.log('\n━━━ TOTAL CONTACTS ON ACCOUNT ━━━');
const total = await api('/api/3/contacts?limit=1');
console.log(`  total: ${total.meta?.total || '?'}`);
