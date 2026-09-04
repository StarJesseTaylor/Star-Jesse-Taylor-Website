// THE CHANNEL — phone normalisation + Twilio send (SMS / WhatsApp).
// Plain Node, raw fetch, no SDKs (this repo has no package.json — an npm import breaks the deploy).
// Creds come from Vercel env ONLY. Never from twilio.json (that file is stale and its token is truncated).

/* ─────────────────────────────  PHONE  ───────────────────────────── */

// Every assigned ITU country calling code. Longest-prefix match, so '1' cannot
// shadow '1242' and '3' cannot shadow '351'.
//
// ⭐ WHY THIS IS NOW THE WHOLE WORLD, Sep 3 2026.
//    This used to be a hand-written list of ~30 codes "we actually see in Star's
//    audience" — heavily European and US. Star mentioned testers in Beijing and
//    Singapore, and NEITHER +86 NOR +65 WAS ON IT. Hong Kong, Japan, Korea and
//    New Zealand were missing too.
//
//    The failure was silent and nasty: normalisePhone() returned
//    'unrecognised country code', send.js pushed the member onto report.skipped,
//    and nobody got a text. No error, no alert, no bounce — the member simply
//    never hears from us and concludes it does not work.
//
//    An allowlist of "countries we expect" is the wrong shape for this. Star's
//    audience is wherever his audience is, and it changes without telling us.
//    The list is now complete, so the only things rejected are numbers that are
//    genuinely malformed.
const CC = [
  // North America / Caribbean (NANP — +1, with area codes validated separately)
  '1',
  // Africa
  '20', '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226',
  '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238',
  '239', '240', '241', '242', '243', '244', '245', '246', '248', '249', '250', '251',
  '252', '253', '254', '255', '256', '257', '258', '260', '261', '262', '263', '264',
  '265', '266', '267', '268', '269', '27', '290', '291', '297', '298', '299',
  // Europe
  '30', '31', '32', '33', '34', '350', '351', '352', '353', '354', '355', '356',
  '357', '358', '359', '36', '370', '371', '372', '373', '374', '375', '376', '377',
  '378', '379', '380', '381', '382', '383', '385', '386', '387', '389', '39',
  '40', '41', '420', '421', '423', '43', '44', '45', '46', '47', '48', '49',
  // Latin America
  '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '51', '52',
  '53', '54', '55', '56', '57', '58', '590', '591', '592', '593', '594', '595',
  '596', '597', '598', '599',
  // Southeast Asia / Oceania
  '60', '61', '62', '63', '64', '65', '66', '670', '672', '673', '674', '675',
  '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687',
  '688', '689', '690', '691', '692',
  // East Asia / Russia / Central Asia
  '7', '81', '82', '84', '850', '852', '853', '855', '856', '86', '880', '886',
  // Middle East / South Asia
  '90', '91', '92', '93', '94', '95', '960', '961', '962', '963', '964', '965',
  '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977',
  '98', '992', '993', '994', '995', '996', '998',
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

  // Letters are never part of a phone number, and stripping them is DANGEROUS:
  // "555-1234 ext 99" would collapse to 5551234 99 -> "555123499", a number that
  // looks plausible, passes every later check, and belongs to nobody. Reject
  // instead of silently inventing a number for a real person.
  if (/[a-z]/i.test(raw)) return { ok: false, reason: 'contains letters (extension or typo?)' };

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

/**
 * Which rail should this number use? SMS — for everyone, everywhere.
 *
 * ⭐ CHANGED Sep 3 2026 (Star: "some of them are in Australia"). This used to
 *    return 'whatsapp' for every non-US number, which meant every Australian
 *    tester would have failed at send with "no from-number for whatsapp",
 *    because TWILIO_WHATSAPP_FROM has never been set.
 *
 * WHY NOT JUST SET UP WHATSAPP:
 *   WhatsApp forbids business-initiated messages outside a 24-hour reply window
 *   unless the exact text is a template Meta approved in advance (error 63016,
 *   already handled in status.js). Our reminders are unprompted and arrive at
 *   random times, so essentially every one of them lands outside that window.
 *   That means all 30 of Star's lines submitted individually for Meta approval,
 *   plus Meta business verification, plus per-conversation billing that is not
 *   meaningfully cheaper than SMS. Weeks of work, same text, same phone.
 *
 * COST: A2P 10DLC is a US-only regime, so international numbers need no
 *   registration at all. International SMS costs a few cents per message
 *   against well under one cent domestically — roughly $1.50/month versus
 *   $0.25/month for one reminder a day. Real, and trivial at this scale.
 *
 * The WhatsApp machinery below is intentionally left intact. A member row can
 * still carry channel='whatsapp' explicitly (send.js honours m.channel first),
 * so if a WhatsApp sender is ever approved, nothing here has to be rebuilt.
 */
export function pickChannel(e164) {
  return 'sms';
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
