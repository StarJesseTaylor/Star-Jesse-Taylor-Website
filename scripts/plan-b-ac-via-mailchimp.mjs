#!/usr/bin/env node
/**
 * Plan B: AC API is blocked for campaign creation. Use MailChimp instead.
 *
 *  Pull AC contacts that have ANY workshop tag (workshop segment).
 *  Pull AC contacts that have skool:waitlist tag (community segment).
 *  Add both groups to MailChimp existing list as a TAG ("ac-workshop" / "ac-community").
 *  Create 2 new MailChimp campaigns, each filtered by tag, scheduled for 9 AM Pacific.
 */
import fs from 'fs';

const AC_CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const MC_CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));

const v3 = `${AC_CONFIG.apiUrl}/api/3`;
const acH = { 'Api-Token': AC_CONFIG.apiKey, Accept: 'application/json' };
const mcBase = `https://${MC_CONFIG.server}.api.mailchimp.com/3.0`;
const mcAuth = `Basic ${Buffer.from(`apikey:${MC_CONFIG.api_key}`).toString('base64')}`;
const MC_LIST_ID = 'cb74bd5290'; // Star's engaged list

const WORKSHOP_TAG_IDS = [23, 52, 50, 35];
const COMMUNITY_TAG_ID = 141;

async function ac(p) {
  const r = await fetch(`${v3}${p}`, { headers: acH });
  if (!r.ok) throw new Error(`AC ${r.status}: ${await r.text()}`);
  return r.json();
}
async function mc(path, opts = {}) {
  const r = await fetch(`${mcBase}${path}`, { ...opts, headers: { Authorization: mcAuth, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const t = await r.text();
  if (!r.ok) throw new Error(`MC ${r.status} on ${path}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : {};
}

async function contactsForTag(tagId) {
  const out = new Set();
  let off = 0;
  while (true) {
    const r = await ac(`/contactTags?filters[tag]=${tagId}&limit=100&offset=${off}`);
    const ids = (r.contactTags || []).map(ct => ct.contact);
    for (const id of ids) out.add(id);
    if (ids.length < 100) break;
    off += 100;
    if (off > 2000) break;
  }
  return out;
}

async function contactById(id) {
  const r = await ac(`/contacts/${id}`);
  return r.contact;
}

console.log('=== Plan B: build AC sends via MailChimp ===\n');
console.log('Step 1: Pull AC workshop-tagged contact IDs...');
const workshopSet = new Set();
for (const tid of WORKSHOP_TAG_IDS) {
  const s = await contactsForTag(tid);
  console.log(`  tag ${tid}: ${s.size} contacts`);
  for (const c of s) workshopSet.add(c);
}
console.log(`  → ${workshopSet.size} unique workshop contacts`);

console.log('\nStep 2: Pull AC community-tagged contact IDs...');
const communitySet = await contactsForTag(COMMUNITY_TAG_ID);
console.log(`  → ${communitySet.size} unique skool:waitlist contacts`);

console.log('\nStep 3: Resolve contact emails (this takes a bit)...');
const workshopEmails = [];
for (const id of workshopSet) {
  try { const c = await contactById(id); if (c?.email) workshopEmails.push({ email: c.email, first: c.firstName, last: c.lastName }); }
  catch (e) { console.error(`  ✗ skip contact ${id}: ${e.message}`); }
}
const communityEmails = [];
for (const id of communitySet) {
  try { const c = await contactById(id); if (c?.email) communityEmails.push({ email: c.email, first: c.firstName, last: c.lastName }); }
  catch (e) { console.error(`  ✗ skip contact ${id}: ${e.message}`); }
}
console.log(`  workshop emails: ${workshopEmails.length}`);
console.log(`  community emails: ${communityEmails.length}`);

// Save to disk so we can manually inspect
fs.writeFileSync('C:/Users/starj/Documents/Star_Pricing_Research/ac-workshop-emails.json', JSON.stringify(workshopEmails, null, 2));
fs.writeFileSync('C:/Users/starj/Documents/Star_Pricing_Research/ac-community-emails.json', JSON.stringify(communityEmails, null, 2));
console.log('  ✓ saved to disk');

console.log('\nStep 4: Add to MailChimp list with tags...');
async function addToMcWithTag(emails, tag) {
  let added = 0;
  let exists = 0;
  for (const e of emails) {
    try {
      // upsert via PUT /lists/{id}/members/{hash}
      const crypto = await import('crypto');
      const hash = crypto.createHash('md5').update(e.email.toLowerCase()).digest('hex');
      await mc(`/lists/${MC_LIST_ID}/members/${hash}`, {
        method: 'PUT',
        body: JSON.stringify({
          email_address: e.email,
          status_if_new: 'subscribed',
          merge_fields: e.first || e.last ? { FNAME: e.first || '', LNAME: e.last || '' } : undefined,
          tags: [tag],
        }),
      });
      added++;
    } catch (err) {
      // try just adding the tag if member already exists
      try {
        const crypto = await import('crypto');
        const hash = crypto.createHash('md5').update(e.email.toLowerCase()).digest('hex');
        await mc(`/lists/${MC_LIST_ID}/members/${hash}/tags`, {
          method: 'POST',
          body: JSON.stringify({ tags: [{ name: tag, status: 'active' }] }),
        });
        exists++;
      } catch (err2) {
        console.error(`    ✗ ${e.email}: ${err2.message.slice(0, 100)}`);
      }
    }
  }
  return { added, exists };
}

console.log('  Tagging workshop contacts...');
const wkRes = await addToMcWithTag(workshopEmails, 'ac-skool-workshop-launch');
console.log(`    added: ${wkRes.added}, already in list (tagged): ${wkRes.exists}`);

console.log('  Tagging community contacts...');
const cmRes = await addToMcWithTag(communityEmails, 'ac-skool-community-launch');
console.log(`    added: ${cmRes.added}, already in list (tagged): ${cmRes.exists}`);

console.log('\n✓ AC contacts now in MailChimp with tags. Next: create 2 MailChimp campaigns filtered by tag.');
console.log('  Workshop tag: ac-skool-workshop-launch');
console.log('  Community tag: ac-skool-community-launch');
