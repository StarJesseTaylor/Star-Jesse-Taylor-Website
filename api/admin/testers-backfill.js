/**
 * Tester Admin: backfill from ActiveCampaign
 *
 * One-time (or re-runnable) endpoint that pulls every existing applicant
 * from ActiveCampaign and populates the Supabase tester_applications
 * table so they appear in the admin dashboard.
 *
 * Star June 14 2026: shipped after the dashboard went live and showed
 * 0 applicants because the Supabase table only captures applications
 * from the moment it was created. Pre-existing applicants sat only in
 * AC + Gmail.
 *
 * Data reconstruction strategy:
 *   - AC has the contact's name, email, and tags
 *   - Tags encode: tier (a/b/c), device, symptoms, goals, history, commitment
 *   - AC does NOT store the free-text answers (worked / not_worked /
 *     specific_moment / notes). Those are only in Star's Gmail. So
 *     backfilled rows have everything needed for tier-based triage,
 *     but the free-text fields are null. Free-text was always more
 *     about understanding WHO they are than deciding IF to invite.
 *   - We compute a score from the available tags so it matches what
 *     the server-side scoring originally returned.
 *
 * Idempotent: re-running will not create duplicates (we upsert on
 * apple_email).
 *
 * Auth: ?key=CRON_SECRET (same as testers-list).
 */

const TAG_PREFIX = 'path:audacity-tester-apply';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function findTagId(AC_URL, headers, tagName) {
  try {
    const res = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}&limit=100`, {
      method: 'GET', headers
    });
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data.tags || []).find((t) => t.tag === tagName);
    return match ? match.id : null;
  } catch {
    return null;
  }
}

async function fetchContactsWithTag(AC_URL, headers, tagId) {
  const contacts = [];
  let offset = 0;
  const limit = 100;
  for (let safety = 0; safety < 50; safety++) {
    const res = await fetch(
      `${AC_URL}/api/3/contacts?tagid=${tagId}&limit=${limit}&offset=${offset}`,
      { method: 'GET', headers },
    );
    if (!res.ok) break;
    const data = await res.json();
    const batch = data.contacts || [];
    if (batch.length === 0) break;
    contacts.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return contacts;
}

async function fetchContactTags(AC_URL, headers, contactId) {
  try {
    const res = await fetch(`${AC_URL}/api/3/contacts/${contactId}/contactTags`, {
      method: 'GET', headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    // contactTags has just tag IDs. We need to resolve names. AC returns
    // the related tags array in the same response via include=tag.
    return (data.contactTags || []).map((ct) => ct.tag);
  } catch {
    return [];
  }
}

async function fetchTagNames(AC_URL, headers, tagIds) {
  if (tagIds.length === 0) return {};
  const out = {};
  // AC tags endpoint accepts ids[] filter but it's per-id GETs that work
  // most reliably across AC plans. Batch in parallel chunks of 10.
  const batches = chunk(tagIds, 10);
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map((id) =>
        fetch(`${AC_URL}/api/3/tags/${id}`, { method: 'GET', headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    );
    results.forEach((r) => {
      if (r && r.tag && r.tag.id) out[r.tag.id] = r.tag.tag;
    });
  }
  return out;
}

function parseTagsToRow(tagNames, contact) {
  const tags = new Set(tagNames);
  const symptoms = [];
  const goals = [];
  const history = [];
  let tier = null;
  let device = null;
  let commitment = null;
  for (const t of tags) {
    if (t.startsWith('tester-symptom-')) symptoms.push(t.slice('tester-symptom-'.length));
    else if (t.startsWith('tester-goal-')) goals.push(t.slice('tester-goal-'.length));
    else if (t.startsWith('tester-history-')) history.push(t.slice('tester-history-'.length));
    else if (t.startsWith('tester-tier-')) tier = t.slice('tester-tier-'.length);
    else if (t === 'tester-device-iphone') device = 'iphone';
    else if (t === 'tester-device-android-waitlist') device = 'android';
    else if (t === 'tester-device-other') device = 'other';
    else if (t.startsWith('tester-commitment-')) commitment = t.slice('tester-commitment-'.length);
  }

  if (!tier && symptoms.length === 0 && goals.length === 0) return null; // not a real applicant

  // Re-derive an approximate score from the available tags so tier
  // sort still works.
  let score = 0;
  if (commitment === 'yes') score += 4;
  else if (commitment === 'maybe') score += 2;
  if (device === 'iphone') score += 2;
  score += Math.min(symptoms.length, 4);
  score += Math.min(goals.length, 2);
  if (history.length > 0 && !history.includes('new')) score += 2;
  if (!tier) {
    if (score >= 10) tier = 'a';
    else if (score >= 6) tier = 'b';
    else tier = 'c';
  }

  return {
    first_name: contact.firstName || '(unknown)',
    last_name: contact.lastName || null,
    apple_email: contact.email,
    device: device,
    symptoms: symptoms.length ? symptoms.join('|') : null,
    goals: goals.length ? goals.join('|') : null,
    duration: null,
    severity: null,
    tried: null,
    worked: null,
    not_worked: null,
    specific_moment: null,
    history: history.length ? history.join('|') : null,
    commitment: commitment,
    notes: 'Backfilled from ActiveCampaign. Free-text answers in Gmail.',
    source: 'backfill-ac',
    score: score,
    tier: tier,
    ac_contact_id: String(contact.id),
    status: 'pending',
  };
}

async function upsertRows(supabaseUrl, serviceKey, rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  // Upsert one at a time to keep idempotency simple (by apple_email
  // uniqueness — we'd need a unique constraint to upsert in bulk).
  // We do a fetch-then-insert pattern instead: check if a row with the
  // same email already exists, skip if so.
  for (const row of rows) {
    const checkUrl = `${supabaseUrl}/rest/v1/tester_applications?apple_email=eq.${encodeURIComponent(row.apple_email)}&select=id`;
    const check = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (check.ok) {
      const existing = await check.json();
      if (existing.length > 0) {
        skipped++;
        continue;
      }
    }
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/tester_applications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (insertRes.ok) inserted++;
  }
  return { inserted, skipped };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!AC_KEY) return res.status(500).json({ error: 'AC key missing' });
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase env vars missing' });

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    const tagId = await findTagId(AC_URL, headers, TAG_PREFIX);
    if (!tagId) {
      return res.status(200).json({ ok: true, message: `Tag "${TAG_PREFIX}" not found in AC`, inserted: 0 });
    }

    const contacts = await fetchContactsWithTag(AC_URL, headers, tagId);

    // For each contact, fetch their tags + resolve tag names.
    const rows = [];
    const errors = [];

    for (const contact of contacts) {
      try {
        const tagIds = await fetchContactTags(AC_URL, headers, contact.id);
        const tagNameMap = await fetchTagNames(AC_URL, headers, tagIds);
        const tagNames = tagIds.map((id) => tagNameMap[id]).filter(Boolean);
        const row = parseTagsToRow(tagNames, contact);
        if (row) rows.push(row);
      } catch (err) {
        errors.push({ contactId: contact.id, error: String(err.message ?? err) });
      }
    }

    const { inserted, skipped } = await upsertRows(supabaseUrl, serviceKey, rows);

    return res.status(200).json({
      ok: true,
      ac_contacts_found: contacts.length,
      rows_built: rows.length,
      inserted,
      skipped_already_existed: skipped,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Backfill failed', detail: String(err.message ?? err) });
  }
}
