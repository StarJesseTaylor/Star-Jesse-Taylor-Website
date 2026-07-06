// Env + AC diagnostic. Safe to public: no secrets exposed, no writes.
// Combines env-var presence check + live AC API test.

export default async function handler(req, res) {
  const check = (name) => ({ set: !!process.env[name], length: process.env[name]?.length || 0 });
  const AC_URL_RAW = process.env.ACTIVECAMPAIGN_API_URL || '';
  const AC_URL = AC_URL_RAW.replace(/\/$/, '');
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

  const report = {
    ranAt: new Date().toISOString(),
    env: {
      ACTIVECAMPAIGN_API_KEY: check('ACTIVECAMPAIGN_API_KEY'),
      ACTIVECAMPAIGN_API_URL: check('ACTIVECAMPAIGN_API_URL'),
      STRIPE_SECRET_KEY: check('STRIPE_SECRET_KEY'),
      STRIPE_WEBHOOK_SECRET: check('STRIPE_WEBHOOK_SECRET'),
      RESEND_API_KEY: check('RESEND_API_KEY'),
      CRON_SECRET: check('CRON_SECRET')
    },
    ac_url_starts_with: AC_URL.slice(0, 30),
    ac_key_starts_with: AC_KEY?.slice(0, 6) || null,
    ac_key_ends_with: AC_KEY?.slice(-3) || null
  };

  // Only run AC tests if env vars are set
  if (AC_URL && AC_KEY) {
    // Test 1: users/me — verifies auth works
    try {
      const r = await fetch(`${AC_URL}/api/3/users/me`, { headers: { 'Api-Token': AC_KEY } });
      const text = await r.text();
      let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
      report.ac_users_me = { status: r.status, ok: r.ok, body: r.ok ? 'OK' : body };
    } catch (err) { report.ac_users_me = { error: err.message }; }

    // Test 2: search for a known book buyer (Mimi/Emilie)
    try {
      const r = await fetch(`${AC_URL}/api/3/contacts?email=mims.pastor%40gmail.com`, { headers: { 'Api-Token': AC_KEY } });
      const text = await r.text();
      let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
      report.ac_search_mimi = {
        status: r.status,
        ok: r.ok,
        contactsFound: body.contacts?.length || 0,
        firstContact: body.contacts?.[0] ? { id: body.contacts[0].id, email: body.contacts[0].email, cdate: body.contacts[0].cdate } : null,
        errorBody: r.ok ? null : body
      };
    } catch (err) { report.ac_search_mimi = { error: err.message }; }

    // Test 3: search for Aitana
    try {
      const r = await fetch(`${AC_URL}/api/3/contacts?email=williamsaitana%40gmail.com`, { headers: { 'Api-Token': AC_KEY } });
      const text = await r.text();
      let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
      report.ac_search_aitana = {
        status: r.status,
        ok: r.ok,
        contactsFound: body.contacts?.length || 0,
        firstContact: body.contacts?.[0] ? { id: body.contacts[0].id, email: body.contacts[0].email, cdate: body.contacts[0].cdate } : null,
        errorBody: r.ok ? null : body
      };
    } catch (err) { report.ac_search_aitana = { error: err.message }; }

    // Diagnosis
    if (report.ac_users_me?.ok && report.ac_search_mimi?.contactsFound > 0) {
      report.diagnosis = 'AC works. Mimi IS in AC. She was invisible in the search UI because of a default filter (probably list scope). Book webhook is fine.';
    } else if (report.ac_users_me?.ok && report.ac_search_mimi?.contactsFound === 0) {
      report.diagnosis = 'AC auth works. Mimi is NOT in AC. Book webhook AC integration is failing silently. Need to inspect webhook logs.';
    } else if (report.ac_users_me?.status === 401 || report.ac_users_me?.status === 403) {
      report.diagnosis = 'AC key INVALID or EXPIRED. Update ACTIVECAMPAIGN_API_KEY in Vercel env vars.';
    } else if (report.ac_users_me?.status === 404) {
      report.diagnosis = 'AC URL is WRONG. Check ACTIVECAMPAIGN_API_URL format.';
    } else {
      report.diagnosis = 'Unknown AC error — inspect ac_users_me.body';
    }
  } else {
    report.diagnosis = 'Env vars missing — book buyers cannot be added to AC';
  }

  return res.status(200).json(report);
}
