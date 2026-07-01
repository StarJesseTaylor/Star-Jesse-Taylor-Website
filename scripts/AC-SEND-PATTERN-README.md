# ActiveCampaign Send Pattern — Proven Working

**Tested Jun 27 2026.** Both 173 + 168 contact sends fired successfully using this recipe.

This document also lives in Claude's auto-memory at:
`C:\Users\starj\.claude\projects\C--Users-starj\memory\reference_ac_proven_send_pattern.md`

---

## The recipe

```javascript
// 1. Compute contact IDs in JavaScript (NOT AC segments — those are broken)
async function tagSet(tagId) {
  const ids = new Set();
  let off = 0;
  while (true) {
    const r = await fetch(`${ac.apiUrl}/api/3/contacts?tagid=${tagId}&limit=100&offset=${off}`, { headers: { 'Api-Token': ac.apiKey } });
    const j = await r.json();
    if (!j.contacts?.length) break;
    j.contacts.forEach(c => ids.add(c.id));
    if (j.contacts.length < 100) break;
    off += 100;
  }
  return ids;
}
// Workshop = union of tags
const workshop = new Set([...(await tagSet(23)), ...(await tagSet(50)), ...(await tagSet(52))]);
// Community = everyone NOT in workshop
const community = [...allIds].filter(id => !workshop.has(id));

// 2. Create dedicated AC list for this send
const list = await POST('/api/3/lists', {
  list: { name: 'Send-Community-Jun27', sender_url: 'starjessetaylor.com', sender_reminder: '...' },
});
const listId = list.list.id;

// 3. Bulk-add contacts (1 POST per contact, ~3 min for 200)
for (const cid of contactIds) {
  await POST('/api/3/contactLists', { contactList: { list: listId, contact: cid, status: 1 } });
}

// 4. Fire campaign with PAST Central-time sdate
await v1('campaign_create', {
  type: 'single',
  name: 'PROD Community v17 Jun27',
  sdate: '2026-06-27 12:00:00',  // PAST Central time — AC fires immediately
  status: 1,                      // 1 = scheduled
  public: 0,
  tracklinks: 'all',
  trackreads: 1,
  [`p[${listId}]`]: listId,       // target the dedicated list
  [`m[${messageId}]`]: 100,       // msg 11 / 12 / etc
});

// 5. Verify (wait 10s, then GET)
const c = await GET(`/api/3/campaigns/${campId}`);
// Expect: status >= 5 (or 7), send_amt > 0, ldate populated
```

---

## What does NOT work (don't try again)

| Approach | Fails because |
|---|---|
| AC v3 PUT on segments → set rules | API doesn't persist conditions; logic stays "and" with empty rules |
| v1 includetag/excludetag in campaign_create | Draft recipient count stays 0 |
| AC v3 /api/3/campaigns/{id}/test | 405 Method Not Allowed |
| v1 campaign_send action=test | 8-campaigns-from-UI threshold blocks new accounts |
| `new Date().toISOString()` for sdate | AC reads UTC string as Central → 5-7 hour future shift |

---

## Time zone trap

AC's server is **US Central Time** (CDT/-05:00 or CST/-06:00).

| Need | Use sdate |
|---|---|
| Fire immediately | Hardcoded past Central: `'2026-06-27 12:00:00'` |
| Schedule for 6:30 PM PT | Central is +2: `'2026-06-27 20:30:00'` |
| Schedule for 9 AM PT Sunday | Central +2: `'2026-06-28 11:00:00'` |

---

## Why dedicated list (not main list 3)

- v3 segment_opts don't filter list 3 properly (segments empty after PUT)
- New list with exact contact IDs = campaign hits exactly those people, no guessing
- Side benefit: clean dashboard, can delete the dedicated list afterward
- Cost: ~3 min of bulk-add API calls for 200 contacts (acceptable for small sends)

---

## When NOT to use this pattern

- For sends > 5,000 contacts: bulk-add is slow. Use AC's bulk import or do via UI.
- For repeating campaigns: build the segment in UI once, reuse it.

---

## Reference scripts (all in this folder)

- `send-community-now.mjs` — full working example (Jun 27)
- `ac-update-messages.mjs` — push HTML to existing AC messages
- `audit-ac-tags-segments.mjs` — list all AC tags with counts
- `ac-segment-counts.mjs` — accurate per-tag contact counts
- `ac-tag-overlap.mjs` — compute tag intersections/unions
