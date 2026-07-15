// Twilio connection check. Safe to be public: no secrets exposed, read-only.
export default async function handler(req, res) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const report = {
    ranAt: new Date().toISOString(),
    sid_set: !!sid,
    sid_format_ok: /^AC[0-9a-f]{32}$/i.test(sid || ''),
    token_set: !!token,
    token_len: token?.length || 0
  };
  if (!sid || !token) { report.result = 'MISSING_ENV_VARS'; return res.status(200).json(report); }
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${auth}` } });
    if (r.ok) {
      const j = await r.json();
      report.result = 'CONNECTED';
      report.account_status = j.status;
      report.account_type = j.type;
    } else {
      report.result = r.status === 401 ? 'AUTH_FAILED_token_wrong' : `HTTP_${r.status}`;
    }
  } catch (e) { report.result = 'ERROR: ' + e.message; }
  return res.status(200).json(report);
}
