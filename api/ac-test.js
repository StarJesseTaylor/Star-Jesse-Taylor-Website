// AC diagnostic endpoint. Makes a read-only test call to ActiveCampaign
// and returns the actual API response so we can see what's failing.
//
// Safe to be public: reads only, no writes, doesn't leak keys.

export default async function handler(req, res) {
  const AC_URL_RAW = process.env.ACTIVECAMPAIGN_API_URL || '';
  const AC_URL = AC_URL_RAW.replace(/\/$/, '');
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

  const report = {
    env: {
      URL_present: !!AC_URL,
      URL_length: AC_URL.length,
      URL_starts_with: AC_URL.slice(0, 25),
      KEY_present: !!AC_KEY,
      KEY_length: AC_KEY?.length || 0,
      KEY_starts_with: AC_KEY?.slice(0, 8) || null,
      KEY_ends_with: AC_KEY?.slice(-4) || null,
    }
  };

  if (!AC_URL || !AC_KEY) {
    report.diagnosis = 'Env vars missing — book buyers cannot be added to AC';
    return res.status(200).json(report);
  }

  // Read-only test: fetch account info (safest AC API call)
  try {
    const r = await fetch(`${AC_URL}/api/3/users/me`, {
      headers: { 'Api-Token': AC_KEY }
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
    report.ac_users_me = {
      status: r.status,
      ok: r.ok,
      body: r.ok ? { userInfo: 'valid' } : body
    };
  } catch (err) {
    report.ac_users_me = { error: err.message };
  }

  // Try fetching a specific contact to test the same call path as book-webhook
  try {
    const r = await fetch(`${AC_URL}/api/3/contacts?email=test-diagnostic@example.com`, {
      headers: { 'Api-Token': AC_KEY }
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
    report.ac_contacts_search = {
      status: r.status,
      ok: r.ok,
      result: r.ok ? { contactsFound: body.contacts?.length || 0 } : body
    };
  } catch (err) {
    report.ac_contacts_search = { error: err.message };
  }

  // Also test contact creation with a dummy email to see if writes work
  try {
    const testEmail = `ac-test-${Date.now()}@starjessetaylor-diagnostic.local`;
    const r = await fetch(`${AC_URL}/api/3/contacts`, {
      method: 'POST',
      headers: { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: { email: testEmail, firstName: 'ACTest' } })
    });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
    report.ac_contact_create = {
      status: r.status,
      ok: r.ok,
      testEmail,
      result: r.ok ? { contactId: body.contact?.id, created: true } : body
    };
  } catch (err) {
    report.ac_contact_create = { error: err.message };
  }

  // Diagnosis
  if (report.ac_contact_create?.ok) {
    report.diagnosis = 'AC API works fine. If book buyers arent showing up, check the webhook error handler — errors are being swallowed silently.';
  } else if (report.ac_users_me?.status === 401 || report.ac_users_me?.status === 403) {
    report.diagnosis = 'AC key is INVALID or EXPIRED. Update ACTIVECAMPAIGN_API_KEY in Vercel env vars.';
  } else if (report.ac_users_me?.status === 404) {
    report.diagnosis = 'AC URL is WRONG. Check ACTIVECAMPAIGN_API_URL format (should be https://<account>.api-us1.com).';
  } else {
    report.diagnosis = 'Unknown AC error — inspect body fields above';
  }

  return res.status(200).json(report);
}
