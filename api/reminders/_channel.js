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

  // No +, but they picked their country from the dropdown. That removes the
  // guess entirely, which is the whole point of the picker.
  if (countryCode) {
    const cc = String(countryCode).replace(/\D/g, '');
    if (!cc || !CC.includes(cc)) return { ok: false, reason: 'unrecognised country code' };

    let nat = s.replace(/^0+/, '');          // drop the national trunk prefix

    // ⭐ THEY OFTEN TYPE THE CODE AS WELL AS PICKING IT.
    //    Picks "United States (+1)", types "14245998317" -> naive concatenation
    //    gives "+114245998317", a number that belongs to nobody and fails
    //    silently at send. Same for an Australian who picks +61 and types
    //    "61412345678". If the number already starts with the code they chose,
    //    and removing it still leaves a plausible national number, remove it.
    if (nat.startsWith(cc) && nat.length - cc.length >= 6) {
      nat = nat.slice(cc.length);
    }

    const digits = cc + nat;
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, reason: `that is ${digits.length} digits, which is not a working number` };
    }
    // +1 must obey the North American Numbering Plan like any other +1 number.
    // Without this, picking "United States" bypassed every area-code check.
    const nanp = validateNANP(digits);
    if (!nanp.ok) return nanp;
    return { ok: true, e164: '+' + digits };
  }

  // 10 digits, no country, no leading 0 -> almost certainly US/Canada.
  if (/^\d{10}$/.test(s) && !s.startsWith('0')) {
    const nanp = validateNANP('1' + s);
    return nanp.ok ? { ok: true, e164: '+1' + s } : nanp;
  }

  // ⭐ 11 digits starting with 1, no plus: "14245998317".
  //    Star typed exactly this into the live form on Sep 21 and was refused.
  //    Almost nobody types the +, and this shape is NOT ambiguous: 1 followed
  //    by 10 digits is the North American Numbering Plan and nothing else.
  //    Refusing it was strictness with no safety value, and it would have cost
  //    a real signup from every American who skips the plus.
  //    Still validated as NANP, so a mangled 11-digit number is refused.
  if (/^1\d{10}$/.test(s)) {
    const nanp = validateNANP(s);
    return nanp.ok ? { ok: true, e164: '+' + s } : nanp;
  }

  // Everything else without a + really is ambiguous. 11 digits starting 4 could
  // be France, Germany, Hungary or a typo, and guessing wrong means texting a
  // stranger while the member hears nothing. Refuse and say what is missing.
  return { ok: false, reason: 'add your country code, like +61 for Australia or +44 for the UK' };
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

import { maySend, reportCapHit } from './_send-cap.js';
import { reserveSend, settleSend } from './_spend.js';
import { alphaReady, prepareAlpha, alphaPreflight, redactUnsubscribe } from './_alpha.js';

/* ─────────────────────────────  SEND  ───────────────────────────── */

/**
 * Send one message. Set dryRun to render everything and skip the wire.
 * @returns {Promise<{sent:boolean, sid?:string, dryRun?:boolean, channel:string, error?:string}>}
 */
/**
 * WHICH NUMBER DO WE TEXT THEM FROM?
 *
 * For two months the answer was "the one number we own", and that was fine
 * until Hana. Her UK mobile refused every message with Twilio error 21612,
 * "cannot be sent with the current combination of To and From". British
 * networks do not carry automated texts from foreign numbers, because that is
 * how the fake-bank-text industry works. Austria, Sweden, Australia and India
 * all accept the US number. The UK does not, and it never will.
 *
 * So the sender is now chosen by where the text is going. Buy a number in a
 * country, add TWILIO_FROM_<ISO> to Vercel, and every member there starts
 * using it on the next cron run. Nothing else changes, nothing is redeployed,
 * and the next country that does this is a purchase rather than a rewrite.
 *
 *   TWILIO_FROM_GB=+447...   ->  every +44 member
 *   TWILIO_FROM_NUMBER=+1... ->  everyone else, as before
 */
/* ⭐ A COUNTRY MISSING FROM HERE IS INVISIBLE, NOT SAFE. Found 24 Oct 2026:
      Greece, the Philippines and Saudi Arabia are all on the blocked list AND
      were absent from this map, so canReach() reported iso:null and happily
      said "reachable". A member there would have been enrolled, told "you are
      in", and received nothing, with no alert to Star. That is the exact bug
      this file exists to prevent, hiding one level down.
      RULE: every ISO in NO_INTERNATIONAL_LONG_CODE must have its dial code
      here, or the block never fires. There is a test for this below the map. */
const DIAL_TO_ISO = {
  '44': 'GB', '61': 'AU', '43': 'AT', '46': 'SE', '91': 'IN', '1': 'US',
  '49': 'DE', '33': 'FR', '34': 'ES', '39': 'IT', '31': 'NL', '353': 'IE',
  '64': 'NZ', '27': 'ZA', '65': 'SG', '852': 'HK', '81': 'JP', '82': 'KR',
  '86': 'CN', '55': 'BR', '52': 'MX', '972': 'IL', '971': 'AE', '48': 'PL',
  // added 24 Oct 2026, all present on Star's Skool member map
  '30': 'GR', '63': 'PH', '966': 'SA', '41': 'CH', '32': 'BE', '47': 'NO',
  '358': 'FI', '62': 'ID', '234': 'NG', '57': 'CO', '90': 'TR', '60': 'MY',
  '51': 'PE', '212': 'MA', '385': 'HR', '386': 'SI', '372': 'EE', '370': 'LT',
  '359': 'BG', '40': 'RO', '351': 'PT', '420': 'CZ', '45': 'DK', '36': 'HU',
  '7': 'RU', '380': 'UA',
};

// NANP shares +1. Do not price Canadian members as US destinations.
const CANADA_NPA = new Set('204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 403 416 418 428 431 437 438 450 468 474 506 514 519 548 579 581 584 587 600 604 613 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905 942'.split(' '));
const OTHER_NANP = new Set('242 246 264 268 284 340 345 441 473 649 658 664 670 671 684 721 758 767 784 787 809 829 849 868 869 876 939'.split(' '));


/* COUNTRIES A US NUMBER CANNOT TEXT, FROM TWILIO'S OWN GUIDELINES.
   Checked 3 Oct 2026 at twilio.com/en-us/guidelines/<iso>/sms, which lists
   "Long code international" as Supported or Not Supported per country.

   This list is the difference between knowing in two minutes and finding out in
   twelve days. Hana signed up from the UK on 22 Sep and has never received a
   single text. Esra's Austrian number worked for eleven days and then the route
   closed, and both times the only way anyone found out was Star asking me.

   Verified Not Supported:  GB, AT
   Verified Supported:      AU, SE, IN, US

   Everything else is unverified and simply not warned about: a wrong warning
   would be worse than none. Check the guidelines page and add the country here
   when a member from somewhere new signs up. */
export const NO_INTERNATIONAL_LONG_CODE = new Set([
  'GB',  // United Kingdom - Star's SECOND BIGGEST country, ~29 members
  'AT',  // Austria        - Esra
  'IT',  // Italy
  'GR',  // Greece
  'PH',  // Philippines
  'AE',  // United Arab Emirates
  'SA',  // Saudi Arabia
]);

/* 🛑 THE GUARD THAT WOULD HAVE CAUGHT TODAY'S BUG. Runs once at import.
      If a country is on the blocked list but has no dial code above, the block
      silently never fires for it. Rather than trust a human to keep two lists
      in step, fail loudly at startup. */
{
  const mapped = new Set(Object.values(DIAL_TO_ISO));
  const orphans = [...NO_INTERNATIONAL_LONG_CODE].filter(iso => !mapped.has(iso));
  if (orphans.length) {
    console.error(
      '[_channel] BLOCKED COUNTRIES WITH NO DIAL CODE: ' + orphans.join(', ') +
      ' - canReach() cannot detect these, so members there will be silently ' +
      'enrolled and never texted. Add their dial codes to DIAL_TO_ISO.'
    );
  }
}

/* ⭐ VERIFIED AGAINST TWILIO'S OWN COUNTRY PAGES, 24 Oct 2026, not guessed.
      Star: "make sure you know all the countries in the Skool community that
      people have so you know that we can access all of them."

      Until today this Set held GB and AT ONLY, because those are the two that
      happened to have testers who complained. It was a list of COMPLAINTS, not
      a list of facts. I read twilio.com/en-us/guidelines/<cc>/sms for every
      country visible on Star's Skool member map and the real list is 3.5x
      longer. Italy, Greece, the Philippines, the UAE and Saudi Arabia were all
      silently unreachable and nobody knew.

      The row that decides it is "Long code international" -> "Twilio supported".
      Note it is NOT the same as the operator row: France, India, Turkey, Poland,
      Brazil, South Africa, Malaysia, Finland, Indonesia and Nigeria all show
      operator "Not Supported" but Twilio "Supported", and they work.

      CONFIRMED REACHABLE (Twilio supported = Supported):
        IE DE ES NL IL CH BE MX NO CO        (operator supported too)
        FR IN TR PL BR ZA MY FI ID NG        (via Twilio)
        US AU SE                             (and proven by real deliveries)

      UNKNOWN, do not assume either way:
        CA - Twilio's page returns "---" for both rows rather than a verdict.
             Deep Shah (+1 587, Alberta) is the test case if he is ever enrolled.

      HOW TO EXTEND THIS: open twilio.com/en-us/guidelines/<iso>/sms, find the
      "Long codes and short codes" table, read the "Long code international"
      column, "Twilio supported" row. Add the country here only if it says Not
      Supported. A wrong entry here silently blocks a member who could have been
      reached, so verify rather than infer.

      THE FIX FOR ANY COUNTRY IN THIS LIST is not code. It is either
      TWILIO_FROM_<ISO>, a number bought in that country (two way, STOP works),
      or TWILIO_ALPHA_<ISO>, a free alphanumeric sender (ONE WAY, so STOP does
      NOT work, and the welcome text's "Reply STOP" promise becomes false).
      senderFor() below already reads both. */

/** Can we actually reach this number with what is configured right now? */
export function canReach(toE164) {
  const s = senderFor(toE164);
  if (!s.iso) return {ok:false,iso:null,why:'unverified destination; route review required'};
  if (s.alpha && !alphaReady(s)) return {ok:false,iso:s.iso,why:'alpha launch has not been approved and configured'};
  if (s.local || s.alpha) return { ok: true, how: s.alpha ? 'alphanumeric sender' : 'local number' };
  if (s.iso && NO_INTERNATIONAL_LONG_CODE.has(s.iso)) {
    return {
      ok: false,
      iso: s.iso,
      why: `Twilio lists "Long code international: Not Supported" for ${s.iso}. ` +
           `A US number cannot text ${s.iso} phones at all. ` +
           `Set TWILIO_FROM_${s.iso} to a number bought there, or TWILIO_ALPHA_${s.iso} to a sender name.`,
    };
  }
  // 2026-10-25: PT/DK/EE/LT reviewed for international sender preservation,
  // two-way support and use-case restrictions, not only the Supported row.
  // Hold sender-rewriting/restricted destinations explicitly, rather than
  // relying on missing prices or disabled account permissions to stop them.
  const verified=new Set('US CA AU SE IN IE DE ES NL CH NO FR TR PL BR PT DK EE LT'.split(' '));
  if(!verified.has(s.iso)) return {ok:false,iso:s.iso,why:'destination route has not been verified'};
  return { ok: true, how: 'the US number' };
}

export function senderFor(toE164) {
  const digits = String(toE164 || '').replace(/^\+/, '');
  if (digits.startsWith('1')) {
    const npa=digits.slice(1,4);
    const iso=CANADA_NPA.has(npa)?'CA':OTHER_NANP.has(npa)?null:'US';
    const local=iso && process.env[`TWILIO_FROM_${iso}`];
    const alpha=iso && process.env[`TWILIO_ALPHA_${iso}`];
    return {from:local||alpha||process.env.TWILIO_FROM_NUMBER,iso,local:!!local,alpha:!local&&!!alpha};
  }
  // Longest dial code first, so 353 beats 35 and 852 beats 85.
  const codes = Object.keys(DIAL_TO_ISO).sort((a, b) => b.length - a.length);
  let matchedIso = null;
  for (const code of codes) {
    if (digits.startsWith(code)) {
      const iso = DIAL_TO_ISO[code];
      // 🛑 REMEMBER THE COUNTRY EVEN WHEN WE FALL THROUGH.
      //    The first version only reported the country when a local sender was
      //    found, so canReach() saw iso:null for Hana and happily reported the
      //    UK as reachable. The one case the whole thing exists for.
      matchedIso = iso;

      // A real local number is always better: it is two way, so STOP works,
      // replies work, and the member can talk back.
      const local = process.env['TWILIO_FROM_' + iso];
      if (local) return { from: local, iso, local: true, alpha: false };

      /* ── THE NO-PURCHASE FALLBACK ──
            Twilio's own UK guidelines say it plainly: "Long code international:
            Not Supported". A US number can NEVER text a UK phone. It is policy,
            not a fault, and no amount of retrying changes it.
            The UK does accept an alphanumeric sender, a name instead of a
            number, which costs nothing and needs no number bought.
            🛑 IT IS ONE WAY. A name cannot receive anything, so the member
            cannot reply and CANNOT TEXT STOP. That is why this is opt-in by
            env var and never a default: the welcome text promises "Reply STOP
            whenever you want out", and sending that from a sender that cannot
            hear STOP would be a lie to the member. Set the alpha sender only
            alongside wording that tells them how to actually opt out. */
      const alpha = process.env['TWILIO_ALPHA_' + iso];
      if (alpha) return { from: alpha, iso, local: false, alpha: true };
    break;
    }
  }
  return { from: process.env.TWILIO_FROM_NUMBER, iso: matchedIso, local: false, alpha: false };
}

export async function sendMessage({ to, body, channel, dryRun = false, kind, dayStartISO, dispatchKey }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromSms = senderFor(to).from;                      // <- country aware
  const fromWa = process.env.TWILIO_WHATSAPP_FROM;         // <- needs Meta sender approval

  if (!sid || !token) return { sent: false, channel, error: 'TWILIO creds not set in env' };

  const from = channel === 'whatsapp' ? fromWa : fromSms;
  if (!from) {
    return { sent: false, channel, error: `no from-number for ${channel} (set ${channel === 'whatsapp' ? 'TWILIO_WHATSAPP_FROM' : 'TWILIO_FROM_NUMBER'})` };
  }

  const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;
  const fromAddr = channel === 'whatsapp' ? `whatsapp:${from}` : from;

  if (dryRun) return { sent: false, dryRun: true, channel, sid: undefined };

  /* 🛑 THE ROUTE GUARD. Added 24 Oct 2026, and it should have existed from
        the day NO_INTERNATIONAL_LONG_CODE did.

        THE BUG IT FIXES. canReach() has existed since 3 Oct and Austria has
        been on the blocked list since then. But canReach() was called in
        exactly ONE place in the whole codebase: api/sms-optin.js, at SIGNUP.
        Nothing on the sending path ever asked. So the system emailed Star the
        minute Esra signed up, and then cheerfully tried her anyway, three
        times a day, every day, for a month. 67 refusals in October alone,
        every one error 21612, every one guaranteed before it was sent.

        Star, 24 Oct: "This should never happen. How does this happen?"
        It happened because a guard that is not on the path is not a guard.

        So it goes HERE, at the wire, next to the send cap, for the same stated
        reason: every path that texts anyone comes through this function, and
        no caller has to be correct for it to hold.

        21612 IS PERMANENT. It is not a temporary failure and retrying it
        tomorrow cannot help, because the route does not exist. The caller is
        told `blocked: true` and `permanent: true` so it can log this as
        BLOCKED rather than as an error, and so the retry logic in send.js does
        not treat a wall as a hiccup.

        It does NOT touch consent. The member stays subscribed and starts
        receiving the moment a sender for their country is configured, which
        is a one-line env var. Nobody is unsubscribed for living somewhere. */
  /* ⚠️ SMS ONLY. WhatsApp does not use long-code routing at all, so the
        blocked-country list is meaningless to it and applying it would refuse
        a perfectly good WhatsApp message to a UK number. Caught by Codex's
        independent audit of 3b44762, where I had applied it to every channel.
        A guard in the wrong place is its own bug. */
  if (channel !== 'whatsapp') {
    const reach = canReach(to);
    if (!reach.ok) {
      if (!reach.iso) {
        const {alertStarThrottled}=await import('./_notify.js');
        await alertStarThrottled({kind:'unknown_country',throttleMinutes:1440,
          subject:'SMS held for an unverified destination',
          html:'<p>A reminder was held because its destination has not been verified. Review the route before enabling it.</p>'}).catch(()=>{});
      }
      return {
        sent: false, channel, from, blocked: true, permanent: true,
        deferred: senderFor(to).alpha && !alphaReady(senderFor(to)),
        iso: reach.iso,
        error: `route unavailable for ${reach.iso}: ${reach.why}`,
      };
    }

    /* 🛑 UNKNOWN IS NOT SAFE. Codex's audit: a Pakistani number (+92) sailed
          straight through, because the guard only blocks countries ON the list
          and +92 is not in DIAL_TO_ISO. "Not known to be bad" was being treated
          as "known to be good", which is exactly the hole that let Greece, the
          Philippines and Saudi Arabia through earlier today.

          So an unrecognised country now FAILS CLOSED. The honest cost: a member
          in a country we simply have not mapped yet gets held back even though
          their route might be fine. That is the right way round. A held message
          is one email away from being fixed; a silently dead member goes unnoticed
          for a month, which is precisely what happened to Hana.

          It TELLS STAR, so held is never silent. Add the dial code to
          DIAL_TO_ISO after checking twilio.com/en-us/guidelines/<cc>/sms and
          the member starts receiving. */
    /* canReach() only reports `iso` when it BLOCKS; on the happy path it
       returns {ok:true} with no country. So ask senderFor() directly, which
       always reports the country it matched. Caught by my own test: the first
       version of this check held the US and Canada as "unrecognised". */
    const matched = senderFor(to).iso;
    if (!matched) {
      try {
        const { alertStarThrottled } = await import('./_notify.js');
        await alertStarThrottled({
          kind: 'unknown_country',
          subject: '❓ Reminders: a member is in a country we have not checked',
          html:
            `<p>A text was held back because this number's country is not in ` +
            `<code>DIAL_TO_ISO</code>, so we cannot tell whether Twilio can reach it.</p>` +
            `<p>Number ends <b>${String(to).slice(-4)}</b>. Nothing was sent and nothing was charged.</p>` +
            `<p>Check <code>twilio.com/en-us/guidelines/&lt;cc&gt;/sms</code>, then add the dial ` +
            `code to <code>DIAL_TO_ISO</code> (and to the blocked list if it is Not Supported).</p>`,
          detail: { last4: String(to).slice(-4) },
          throttleMinutes: 720,
        });
      } catch { /* an alert must never be why a guard fails */ }
      return {
        sent: false, channel, from, blocked: true, permanent: false,
        iso: null,
        error: 'country not recognised, holding rather than guessing (Star has been told)',
      };
    }
  }

  // 🛑 THE LAST LINE BEFORE THE WIRE. Every path that texts anyone goes
  //    through here, so the guard lives here and not in the callers. On
  //    21 Sep 2026 one wrong word in a welcome dedupe sent four members five
  //    texts each in five minutes and cost Star a member. No caller has to be
  //    correct for this to hold. See _send-cap.js.
  const guard = await maySend(to, { kind, dayStartISO, from });
  if (!guard.allow) {
    await reportCapHit(to, guard);
    return { sent: false, channel, from, blocked: true, permanent:!!guard.permanent, error: 'send cap: ' + guard.reason };
  }

  const selected = senderFor(to);
  const alpha = channel === 'sms' && selected.alpha;
  if (alpha) {
    try { body = await prepareAlpha({to, body, kind, sender:selected}); }
    catch (e) { return {sent:false,blocked:true,permanent:true,deferred:true,channel,from,error:e.message}; }
  }
  const reservation = await reserveSend({dispatchKey,to,from,channel,kind,body,iso:selected.iso,alpha});
  if (!reservation.allow) return {sent:false,blocked:true,permanent:true,channel,from,error:'budget hold: '+reservation.reason};

  // Recheck after reservation; an unsubscribe can cancel a pending dispatch.
  // This cannot recall a request already submitted to the provider.
  try {
    if (!await alphaPreflight(dispatchKey,to)) throw new Error('dispatch stopped before submission');
  } catch {
    await settleSend(dispatchKey,{state:'cancelled_preflight',from,to,channel});
    return {sent:false,blocked:true,permanent:true,channel,from,error:'final suppression check failed or dispatch stopped'};
  }

  const params = new URLSearchParams({ To: toAddr, From: fromAddr, Body: body });

  // THE RECEIPT. Without this Twilio tells us "queued" and never speaks again —
  // and "queued" is not "a human received it". Carriers drop A2P messages
  // silently, so this callback is the ONLY way to learn a text didn't land.
  // See api/reminders/status.js.
  const site = (process.env.SITE_URL || 'https://starjessetaylor.com').replace(/\/$/, '');
  params.set('StatusCallback', `${site}/api/reminders/status`);
  let res;
  try {
  res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });
  } catch {
    await settleSend(dispatchKey,{state:'unknown',from,to,channel});
    return {sent:false,unknown:true,permanent:true,channel,from,error:'provider outcome unknown; manual reconciliation required'};
  }

  const data = await res.json().catch(() => ({}));
  // `from` travels back with every outcome. A failure is only meaningful
  // alongside the number it was attempted from: 21612 says "not from THIS
  // number", and the guard in _send-cap.js lifts itself once that changes.
  //
  // 🛑 CARRY TWILIO'S ERROR CODE, NOT JUST ITS SENTENCE.
  //    The first version of the unreachable guard searched the stored error
  //    text for "21612" and never matched, because Twilio puts the code in
  //    `data.code` and the prose in `data.message`. The guard looked right,
  //    shipped, and Hana was still hammered 21 times in twenty minutes the same
  //    morning. A code is a stable identifier; a sentence is marketing copy
  //    that can be reworded tomorrow. Match on the code.
  if (!res.ok) {
    await settleSend(dispatchKey,{state:'rejected',code:data?.code,from,to,channel});
    return {
      sent: false, channel, from,
      permanent: true,
      code: data?.code,
      error: `Twilio ${res.status} [${data?.code ?? '?'}]: ${data?.message || 'unknown'}`,
    };
  }
  if (!/^SM[0-9a-f]{32}$/i.test(data.sid || '')) {
    await settleSend(dispatchKey,{state:'unknown',from,to,channel});
    return {sent:false,unknown:true,permanent:true,channel,from,error:'provider response missing valid SID; no automatic retry'};
  }
  await settleSend(dispatchKey,{state:'accepted',sid:data.sid,from,to,channel});
  return { sent: true, sid: data.sid, channel, from, body: redactUnsubscribe(body) };
}
