// Country-gated pilot. Configuration is inert until explicit launch approval.
import { createHash, createHmac } from 'node:crypto';
import { alphaCountryApproved, numericOneWayApproved, oneWayPolicy, alphaTimeAllowed, alphaConsentVersion } from './_alpha-countries.js';

export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{24}$/.test(token);
export const redactUnsubscribe = body => body.replace(/(https:\/\/starjessetaylor\.com\/api\/u\?t=)[A-Za-z0-9_-]{24}/g, '$1[redacted]');
export async function alphaRpc(name, args) {
  const root = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root || !key) throw new Error('unsubscribe database unavailable');
  const r = await fetch(`${root}/rest/v1/rpc/${name}`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error('unsubscribe database refused operation');
  return r.json();
}
const senderName = name => /^[A-Za-z0-9 ]{1,11}$/.test(name || '') && /[A-Za-z]/.test(name || '');
// Which one-way route this sender is on: 'alpha', 'numeric', or null (normal two-way).
export function oneWayRoute(sender) {
  if (!sender || sender.local) return null;
  if (sender.alpha) return 'alpha';
  return sender.oneWay === 'numeric' ? 'numeric' : null;
}
function sharedOneWayConfig(iso) {
  const policy = oneWayPolicy(iso);
  return !!policy
    && (process.env.SMS_UNSUBSCRIBE_SECRET || '').length >= 32
    && !!alphaConsentVersion(iso)
    && !!process.env.SMS_ALPHA_WELCOME
    && (process.env.SMS_ALPHA_FOOTER || '').split('{url}').length === 2
    && (!policy.bodyIdentity || senderName(process.env.SMS_ONEWAY_IDENTITY));
}
export function alphaReady(sender) {
  return alphaCountryApproved(sender.iso) && senderName(sender.from) && sharedOneWayConfig(sender.iso);
}
export function numericOneWayReady(sender) {
  return sender?.oneWay === 'numeric' && !sender.alpha && !sender.local
    && numericOneWayApproved(sender.iso) && sharedOneWayConfig(sender.iso);
}
export function oneWayReady(sender) {
  const route = oneWayRoute(sender);
  return route === 'alpha' ? alphaReady(sender) : route === 'numeric' ? numericOneWayReady(sender) : false;
}
export async function prepareAlpha({ to, body, kind, sender }) {
  if (!oneWayReady(sender)) throw new Error('one-way launch configuration incomplete');
  if (!alphaTimeAllowed(sender.iso)) throw new Error('alpha destination quiet time; no send');
  if (!['welcome', 'reminder'].includes(kind)) throw new Error('alpha is outbound reminders only');
  const eligibility = await alphaRpc('sms_alpha_eligible', {
    p_phone: to, p_version: alphaConsentVersion(sender.iso),
  });
  if (eligibility !== true) throw new Error('alpha consent or paid eligibility unverified');
  // Opaque 144-bit bearer token, no phone number in the URL. Only its hash is stored.
  // Old token hashes remain valid when the secret rotates, so old texts can still opt out.
  const token = createHmac('sha256', process.env.SMS_UNSUBSCRIBE_SECRET)
    .update('sms-unsubscribe:v1:' + to).digest('base64url').slice(0, 24);
  const registered = await alphaRpc('register_sms_unsubscribe', { p_phone: to, p_hash: tokenHash(token) });
  if (registered !== true) throw new Error('unsubscribe token could not be registered');
  const url = 'https://starjessetaylor.com/api/u?t=' + token;
  const footer = process.env.SMS_ALPHA_FOOTER.replace('{url}', url);
  // Never rewrite Star's reminder. The approved footer is appended before pricing.
  const text = kind === 'welcome' ? process.env.SMS_ALPHA_WELCOME : body;
  // Where the network rewrites the sender, the approved sender name leads the text
  // so the member can still tell who it is from. The reminder itself is unchanged.
  const identified = oneWayPolicy(sender.iso)?.bodyIdentity ? `${process.env.SMS_ONEWAY_IDENTITY}: ${text}` : text;
  return identified + '\n' + footer;
}
export const prepareOneWay = prepareAlpha;
export async function alphaPreflight(dispatchKey, phone) {
  return (await alphaRpc('sms_dispatch_still_allowed', { p_key: dispatchKey, p_phone: phone })) === true;
}
