#!/usr/bin/env node
/** READ-ONLY. Build the exact ledger of which emails each of Star's addresses received today,
 *  grouped by true Gmail inbox, flagging any genuine duplicate. */
import fs from 'fs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;
async function GET(p) { const r = await fetch(BASE + p, { headers: { 'Api-Token': CFG.apiKey } }); return JSON.parse(await r.text()); }
async function members(listId) {
  const out = []; let o = 0;
  while (true) { const d = await GET(`/api/3/contacts?listid=${listId}&status=1&limit=100&offset=${o}`);
    for (const c of d.contacts) out.push((c.email || '').toLowerCase());
    if (!d.contacts || d.contacts.length < 100) break; o += 100; }
  return out;
}
const isStar = e => /starjessetaylor|jessetaylor|traxxx/i.test(e);
// true gmail inbox: strip +tag and dots in local part
const inbox = e => {
  const [loc, dom] = e.split('@');
  if (dom === 'gmail.com' || dom === 'googlemail.com') return loc.split('+')[0].replace(/\./g, '') + '@gmail';
  return e;
};

// v16 recipients = list 5 (prod #21) + test #14 (which sent ONLY to starjessetaylor@gmail.com)
// v17 recipients = list 7 (prod #20) + test #13 (which sent ONLY to starjessetaylor@gmail.com)
const v16 = (await members(5)).filter(isStar).map(e => ({ e, mail: 'v16 workshop', when: '7:01pm (prod)' }));
const v17 = (await members(7)).filter(isStar).map(e => ({ e, mail: 'v17 community', when: '6:56pm (prod)' }));
const tests = [
  { e: 'starjessetaylor@gmail.com', mail: 'v16 workshop', when: '6:28pm (1-person test)' },
  { e: 'starjessetaylor@gmail.com', mail: 'v17 community', when: '6:28pm (1-person test)' },
];
const all = [...tests, ...v17, ...v16];

// group by true inbox
const byInbox = {};
for (const r of all) { const k = inbox(r.e); (byInbox[k] ||= []).push(r); }

console.log('PER-INBOX LEDGER (your addresses only)\n' + '='.repeat(64));
let totalEmails = 0, realDupes = 0;
for (const [box, rows] of Object.entries(byInbox)) {
  console.log(`\nInbox: ${box}   (${rows.length} email${rows.length > 1 ? 's' : ''})`);
  // detect same email content twice in same inbox
  const counts = {};
  for (const r of rows) { counts[r.mail] = (counts[r.mail] || 0) + 1; console.log(`   - ${r.mail.padEnd(14)} via ${r.e.padEnd(42)} ${r.when}`); }
  totalEmails += rows.length;
  for (const [mail, n] of Object.entries(counts)) if (n > 1) { realDupes++; console.log(`   ** DUPLICATE: ${mail} received ${n}x in this inbox **`); }
}
console.log('\n' + '='.repeat(64));
console.log(`Total emails to your addresses: ${totalEmails}`);
console.log(`Genuine duplicates (same email twice, same inbox): ${realDupes}`);
