// THE DOOR — proves an inbound webhook actually came from Twilio.
//
// WHY THIS EXISTS
// ---------------
// /api/reminders/inbound and /api/reminders/status are public URLs. Without this
// check, anyone who learns either URL can POST form data and be believed:
//
//   • POST From=<a member's number>&Body=STOP   -> silently unsubscribes them
//   • POST From=<a member's number>&Body="<crisis phrase>" -> fakes a 3am crisis
//     alert to Star, and flags a member who is perfectly fine
//   • POST MessageStatus=delivered              -> poisons the delivery numbers
//
// HOW TWILIO SIGNS (https://www.twilio.com/docs/usage/security)
//   1. Take the full URL Twilio was configured to call, query string included.
//   2. Sort the POST params by key, then append each key immediately followed by
//      its value to that URL string. No separators at all.
//   3. HMAC-SHA1 the result with the account's AUTH TOKEN, base64 the digest.
//   4. Send it as the X-Twilio-Signature header.
// We redo that and compare. Same token, same URL, same params -> same string.
//
// 🛑 FAILS CLOSED. A request we cannot verify is rejected, not "let through just
//    in case". The caller is expected to alert Star when this returns false, so a
//    misconfigured URL surfaces as an email in minutes instead of silently
//    swallowing inbound messages for weeks.

import crypto from 'crypto';

/**
 * Rebuild the exact string Twilio signed.
 * Values are appended raw — Twilio signs the DECODED value, not the encoded one,
 * which is why we work from the parsed body rather than the raw payload.
 */
function signable(url, params) {
  let s = url;
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    // Twilio never repeats a key. If a proxy hands us an array anyway, join it
    // rather than stringifying to "a,b" via implicit coercion somewhere subtle.
    s += key + (Array.isArray(v) ? v.join('') : (v ?? ''));
  }
  return s;
}

function hmac(token, str) {
  return crypto.createHmac('sha1', Buffer.from(token, 'utf-8')).update(Buffer.from(str, 'utf-8')).digest('base64');
}

/** Constant-time compare. A plain === leaks the signature one byte at a time. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Every URL this request could legitimately have been signed against.
 *
 * We cannot just trust the Host header — behind Vercel's proxy it can be the
 * deployment hostname, the apex, or www, and Twilio signed exactly ONE of them
 * (whatever string is typed into the Twilio console). Rather than guess, we
 * accept a small closed set of URLs we own. This is not a security hole: an
 * attacker still needs the auth token to produce a valid signature for any of
 * them. It only stops us from rejecting our own traffic over a www prefix.
 */
function candidateUrls(req) {
  const path = req.url || '';
  const site = (process.env.SITE_URL || 'https://starjessetaylor.com').replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';

  const urls = [
    `${site}${path}`,
    `${site.replace('://', '://www.')}${path}`,
    `${site.replace('://www.', '://')}${path}`,
  ];
  if (host) urls.push(`${proto}://${host}${path}`);

  return [...new Set(urls)];
}

/**
 * @returns {{ok: boolean, reason?: string}} ok:true only if the signature checks out.
 */
export function verifyTwilio(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return { ok: false, reason: 'TWILIO_AUTH_TOKEN not set' };

  const given = req.headers['x-twilio-signature'];
  if (!given) return { ok: false, reason: 'no X-Twilio-Signature header' };

  const params = (req.body && typeof req.body === 'object') ? req.body : {};

  for (const url of candidateUrls(req)) {
    if (safeEqual(given, hmac(token, signable(url, params)))) return { ok: true };
  }
  return { ok: false, reason: 'signature did not match any known URL for this site' };
}
