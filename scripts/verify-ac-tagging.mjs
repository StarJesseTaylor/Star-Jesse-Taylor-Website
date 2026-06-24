import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('C:\\Users\\starj\\.claude\\secrets\\activecampaign.json', 'utf-8'));
const TEST_EMAIL = 'wn-verify-tagging-2026-06-24@starjessetaylor.com';
const EXPECTED_TAGS = ['source:whats-next', 'interest:skool-community', 'path:skool-public', 'skool:waitlist'];
const EXPECTED_LIST = '3';
const headers = { 'Api-Token': cfg.apiKey };

async function ac(path) {
  const res = await fetch(`${cfg.apiUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`AC ${path} -> ${res.status}`);
  return res.json();
}

// Find contact
const found = await ac(`/api/3/contacts?email=${encodeURIComponent(TEST_EMAIL)}`);
const contact = found.contacts && found.contacts[0];
if (!contact) {
  console.log(JSON.stringify({ contactFound: false, email: TEST_EMAIL }, null, 2));
  process.exit(0);
}

// Tags
const tagsLink = await ac(`/api/3/contacts/${contact.id}/contactTags`);
const tagIds = (tagsLink.contactTags || []).map(t => t.tag);
const tagNames = [];
for (const id of tagIds) {
  const t = await ac(`/api/3/tags/${id}`);
  tagNames.push(t.tag.tag);
}

// Lists
const listsLink = await ac(`/api/3/contacts/${contact.id}/contactLists`);
const lists = (listsLink.contactLists || []).map(l => ({ list: l.list, status: l.status }));

const missing = EXPECTED_TAGS.filter(t => !tagNames.includes(t));
const extra = tagNames.filter(t => !EXPECTED_TAGS.includes(t));
const onList3 = lists.some(l => l.list === EXPECTED_LIST && l.status === '1');

console.log(JSON.stringify({
  contactFound: true,
  contactId: contact.id,
  firstName: contact.firstName,
  lastName: contact.lastName,
  email: contact.email,
  tagsApplied: tagNames,
  tagsMissing: missing,
  tagsExtra: extra,
  lists,
  listSubscribed: onList3,
  verdict: missing.length === 0 && onList3 && contact.lastName === 'TaggingCheck' ? 'PASS' : 'PARTIAL',
}, null, 2));
