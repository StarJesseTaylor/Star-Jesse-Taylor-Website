import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('C:\\Users\\starj\\.claude\\secrets\\activecampaign.json', 'utf-8'));
const headers = { 'Api-Token': cfg.apiKey };

async function ac(path) {
  const res = await fetch(`${cfg.apiUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`AC ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// Pull the most recently created contacts. AC returns them in modification order by default;
// we want by creation time descending so we use orders[cdate]=DESC.
const recent = await ac('/api/3/contacts?orders[cdate]=DESC&limit=20');

console.log(`\nMOST RECENT 20 contacts in AC:\n`);
for (const c of recent.contacts || []) {
  const cdate = c.cdate;
  const udate = c.udate;
  console.log(`  ${c.id}  ${c.email.padEnd(48)}  cdate=${cdate}  first=${c.firstName || ''} last=${c.lastName || ''}`);
}

// Now look specifically for any contacts who got the skool-community tag.
// First find the tag ID.
const tagSearch = await ac('/api/3/tags?search=interest:skool-community');
const skoolTag = (tagSearch.tags || []).find(t => t.tag === 'interest:skool-community');

if (!skoolTag) {
  console.log('\nNO interest:skool-community tag exists yet in AC. That means nobody has signed up via the new form.');
  process.exit(0);
}

console.log(`\nSkool community tag id: ${skoolTag.id}`);

const tagged = await ac(`/api/3/tags/${skoolTag.id}/contactTags?limit=50`);
const ctIds = (tagged.contactTags || []).map(ct => ({ contact: ct.contact, ct_cdate: ct.cdate }));
console.log(`\n${ctIds.length} contacts have the interest:skool-community tag.\n`);

// Fetch each contact to see who they are
for (const item of ctIds) {
  try {
    const c = (await ac(`/api/3/contacts/${item.contact}`)).contact;
    console.log(`  tagged ${item.ct_cdate}  ${c.email.padEnd(48)}  first=${c.firstName || ''} last=${c.lastName || ''}`);
  } catch (err) {
    console.log(`  tagged ${item.ct_cdate}  contact ${item.contact} (lookup failed: ${err.message})`);
  }
}
