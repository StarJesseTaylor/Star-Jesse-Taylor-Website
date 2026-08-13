// THE CHANNEL — phone normalisation + Twilio send (SMS / WhatsApp).
// Plain Node, raw fetch, no SDKs (this repo has no package.json — an npm import breaks the deploy).
// Creds come from Vercel env ONLY. Never from twilio.json (that file is stale and its token is truncated).

/* ─────────────────────────────  PHONE  ───────────────────────────── */

// Country calling codes we actually see in Star's audience (heavily European + US).
// Longest-prefix match, so +1 doesn't shadow +ростов etc.
const CC = [
  '1',           // US / Canada
  '44',          // UK
  '49',          // Germany
  '31',          // Netherlands
  '351',         // Portugal
  '353',         // Ireland
  '30',          // Greece
  '32',          // Belgium
  '36',          // Hungary
  '39',          // Italy
  '34',          // Spain
  '380',         // Ukraine
  '90',          // Turkey
  '91',          // India
  '61',          // Australia
  '971',         // UAE
  '33', '41', '43', '45', '46', '47', '48', '420', '421', '385', '386', '40', '359',
];

/**
 * A +1 number must obey the North American Numbering Plan, or it is not real.
 * Caught by [Website] on the board 2026-07-16: "+1040123456" passed my first version.
 * It starts with +1 and has no leading zero after the +, so it LOOKED valid —
 * but 040 is not an area code and never can be. A mangled international number
 * that happens to begin with 1 sails straight through and fails silently at send.
 * Same bug class as sms-optin.js:39, reintroduced by me in the fix for it.
 *
 * NANP: +1 then exactly 10 digits. Area code (NPA) and exchange (NXX) both start 2-9.
 */
function validateNANP(digits) {
  if (!digits.startsWith('1')) return { ok: true };   // not a +1 number, not our rule
  const nat = digits.slice(1);
  if (nat.length !== 10) return { ok: false, reason: `US number needs 10 digits, got ${nat.length}` };
  const npa = nat.slice(0, 3);
  const nxx = nat.slice(3, 6);
  if (!/^[2-9]/.test(npa)) return { ok: false, reason: `invalid area code ${npa} (cannot start 0 or 1)` };
  if (!/^[2-9]/.test(nxx)) return { ok: false, reason: `invalid exchange ${nxx} (cannot start 0 or 1)` };
  if (/^\d11$/.test(npa)) return { ok: false, reason: `${npa} is a service code, not an area code` };
  return { ok: true };
}

/**
 * Normalise a phone number to strict E.164, or explain why we can't.
 *
 * THE BUG THIS FIXES: api/sms-optin.js:39 does
 *     phoneDigits.startsWith('+') ? phoneDigits : (len===10 ? `+1${d}` : `+${d}`)
 * A UK mobile typed as 07911123456 becomes "+07911123456" — not a real number.
 * E.164 never has a 0 straight after the +. Three of Star's live records are broken this way.
 * We now REJECT ambiguous input instead of inventing a number that silently fails to send.
 *
 * @param {string} raw           what the user typed
 * @param {string} [countryCode] optional ISO-ish dial code without + (e.g. '44'), from a form dropdown
 * @returns {{ok:true, e164:string} | {ok:false, reason:string}}
 */
export function normalisePhone(raw, countryCode) {
  if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };

  // Keep digits, and a leading + if present. Strip spaces, dashes, brackets, dots.
  let s = raw.trim().replace(/[^\d+]/g, '');
  // 00 is the international prefix in most of the world. 004479... => +4479...
  if (s.startsWith('00')) s = '+' + s.slice(2);

  if (s.startsWith('+')) {
    const digits = s.slice(1);
    if (!/^\d+$/.test(digits)) return { ok: false, reason: 'non-numeric' };
    // THE GUARD: a leading zero after + is always wrong. This is the +07... case.
    if (digits.startsWith('0')) {
      return { ok: false, reason: 'leading zero after + (domestic format, country unknown)' };
    }
    if (digits.length < 8 || digits.length > 15) return { ok: false, reason: `length ${digits.length}` };
    const cc = CC.filter((c) => digits.startsWith(c)).sort((a, b) => b.length - a.length)[0];
    if (!cc) return { ok: false, reason: 'unrecognised country code' };
    const nanp = validateNANP(digits);
    if (!nanp.ok) return nanp;
    return { ok: true, e164: '+' + digits };
  }

  // No +. We need a country to be sure. Trunk-zero ("07911...") is meaningless without one.
  if (countryCode) {
    const cc = String(countryCode).replace(/\D/g, '');
    let nat = s.replace(/^0+/, ''); // drop the national trunk prefix
    const e164 = '+' + cc + nat;
    const digits = e164.slice(1);
    if (digits.length < 8 || digits.length > 15) return { ok: false, reason: `length ${digits.length}` };
    return { ok: true, e164 };
  }

  // 10 digits, no country, no leading 0 -> almost certainly US/Canada.
  if (/^\d{10}$/.test(s) && !s.startsWith('0')) return { ok: true, e164: '+1' + s };

  return { ok: false, reason: 'no country code and not a 10-digit US number' };
}

/** Which rail should this number use? SMS for US/Canada, WhatsApp for everyone else. */
export function pickChannel(e164) {
  return e164.startsWith('+1') ? 'sms' : 'whatsapp';
}

/* ─────────────────────────────  SEND  ───────────────────────────── */

/**
 * Send one message. Set dryRun to render everything and skip the wire.
 * @returns {Promise<{sent:boolean, sid?:string, dryRun?:boolean, channel:string, error?:string}>}
 */
export async function sendMessage({ to, body, channel, dryRun = false }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromSms = process.env.TWILIO_FROM_NUMBER;          // <- Star must buy this
  const fromWa = process.env.TWILIO_WHATSAPP_FROM;         // <- needs Meta sender approval

  if (!sid || !token) return { sent: false, channel, error: 'TWILIO creds not set in env' };

  const from = channel === 'whatsapp' ? fromWa : fromSms;
  if (!from) {
    return { sent: false, channel, error: `no from-number for ${channel} (set ${channel === 'whatsapp' ? 'TWILIO_WHATSAPP_FROM' : 'TWILIO_FROM_NUMBER'})` };
  }

  const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const fromAddr = channel === 'whatsapp' ? `whatsapp:${from}` : from;

  if (dryRun) return { sent: false, dryRun: true, channel, sid: undefined };

  const params = new URLSearchParams({ To: toAddr, From: fromAddr, Body: body });

  // THE RECEIPT. Without this Twilio tells us "queued" and never speaks again —
  // and "queued" is not "a human received it". Carriers drop A2P messages
  // silently, so this callback is the ONLY way to learn a text didn't land.
  // See api/reminders/status.js.
  const site = (process.env.SITE_URL || 'https://starjessetaylor.com').replace(/\/$/, '');
  params.set('StatusCallback', `${site}/api/reminders/status`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { sent: false, channel, error: `Twilio ${res.status}: ${data?.message || 'unknown'}` };
  return { sent: true, sid: data.sid, channel };
}
