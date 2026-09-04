// KEEP ACTIVECAMPAIGN HONEST ABOUT WHO IS ACTUALLY TEXTABLE.
//
// THE GAP THIS CLOSES
// -------------------
// api/sms-optin.js tags a contact `sms:consented` when they opt in. Nothing
// ever removed it. So when someone texted STOP, the reminder engine stopped
// instantly (correct, and legally required) but ActiveCampaign carried on
// saying they were consented, forever.
//
// That is not a cosmetic problem. Star segments and writes to that list. A
// segment built on `sms:consented` would keep counting people who have
// explicitly opted out, so the list looks bigger than it is and any decision
// made from it is wrong. Worse, it is the exact record you would want to be
// accurate if anyone ever asked when someone opted out.
//
// HOW A CONTACT IS FOUND
// ----------------------
// inbound.js only ever knows a phone number. It has no email, and
// member_channel has no ActiveCampaign id. So we search AC by number and then
// VERIFY the match by comparing digits, because AC's search is fuzzy and
// tagging the wrong person's record would be worse than doing nothing.
//
// EVERYTHING HERE IS BEST EFFORT. An ActiveCampaign outage must never stop a
// STOP from being honoured. Every function swallows its own errors.

const AC_URL = () =>
  (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');

const headers = () => ({
  'Api-Token': process.env.ACTIVECAMPAIGN_API_KEY,
  'Content-Type': 'application/json',
});

/** Digits only, so +1 (424) 599-9831 and +14245999831 compare equal. */
const digits = (s) => String(s || '').replace(/\D/g, '');

/**
 * Find the AC contact that owns this phone number.
 * Returns the contact id, or null when there is no CONFIDENT match.
 */
async function findContactByPhone(phone) {
  const want = digits(phone);
  if (!want) return null;

  const res = await fetch(`${AC_URL()}/api/3/contacts?search=${encodeURIComponent(phone)}&limit=25`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));

  // Verify, don't trust. AC's `search` is a loose match across several fields,
  // so an unverified hit could be a completely different person who happens to
  // share a digit run. Compare the last 9 digits, which survives a contact
  // stored with or without its country code.
  const tail = (d) => d.slice(-9);
  const hit = (data.contacts || []).find((c) => tail(digits(c.phone)) === tail(want) && tail(want).length >= 7);
  return hit ? hit.id : null;
}

/** Ensure a tag exists and return its id. */
async function tagId(name) {
  const found = await fetch(`${AC_URL()}/api/3/tags?search=${encodeURIComponent(name)}`, { headers: headers() });
  if (found.ok) {
    const d = await found.json().catch(() => ({}));
    const exact = (d.tags || []).find((t) => (t.tag || '').toLowerCase() === name.toLowerCase());
    if (exact) return exact.id;
  }
  const made = await fetch(`${AC_URL()}/api/3/tags`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ tag: { tag: name, tagType: 'contact' } }),
  });
  if (!made.ok) return null;
  const d = await made.json().catch(() => ({}));
  return d.tag?.id || null;
}

async function addTag(contactId, name) {
  const id = await tagId(name);
  if (!id) return;
  await fetch(`${AC_URL()}/api/3/contactTags`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ contactTag: { contact: contactId, tag: id } }),
  }).catch(() => {});
}

async function removeTag(contactId, name) {
  const id = await tagId(name);
  if (!id) return;
  // A tag is removed by deleting the JOIN row, not the tag itself. Deleting the
  // tag would strip it from every other contact who has it.
  const res = await fetch(`${AC_URL()}/api/3/contacts/${contactId}/contactTags`, { headers: headers() });
  if (!res.ok) return;
  const d = await res.json().catch(() => ({}));
  const join = (d.contactTags || []).find((ct) => String(ct.tag) === String(id));
  if (!join) return;
  await fetch(`${AC_URL()}/api/3/contactTags/${join.id}`, { method: 'DELETE', headers: headers() }).catch(() => {});
}

/**
 * Mirror an SMS status change into ActiveCampaign.
 *
 * @param {string} phone   E.164 number the message came from
 * @param {'stopped'|'active'} status
 * @returns {Promise<{ok:boolean, reason?:string, contactId?:number}>}
 */
export async function syncSmsStatusToAC(phone, status) {
  if (!process.env.ACTIVECAMPAIGN_API_KEY) return { ok: false, reason: 'no AC key' };
  try {
    const contactId = await findContactByPhone(phone);
    if (!contactId) return { ok: false, reason: 'no confident contact match for that number' };

    if (status === 'stopped') {
      // Add first. If the process dies between the two calls, a contact carrying
      // both tags is obviously mid-update; one carrying neither looks like they
      // never consented at all, which destroys the consent trail.
      await addTag(contactId, 'sms:stopped');
      await removeTag(contactId, 'sms:consented');
      // A dated note, because the tag says WHAT and the note says WHEN. This is
      // the record you want if anyone ever asks about an opt-out.
      await fetch(`${AC_URL()}/api/3/notes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          note: {
            note: `SMS opt-out recorded ${new Date().toISOString()}. The contact replied STOP from ${phone}. Texting stopped immediately. Do not add this number back to SMS unless they opt in again themselves.`,
            relid: contactId,
            reltype: 'Subscriber',
          },
        }),
      }).catch(() => {});
    } else {
      await addTag(contactId, 'sms:consented');
      await removeTag(contactId, 'sms:stopped');
      await fetch(`${AC_URL()}/api/3/notes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          note: {
            note: `SMS opt-in restored ${new Date().toISOString()}. The contact replied START from ${phone} themselves.`,
            relid: contactId,
            reltype: 'Subscriber',
          },
        }),
      }).catch(() => {});
    }

    return { ok: true, contactId };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 200) };
  }
}
