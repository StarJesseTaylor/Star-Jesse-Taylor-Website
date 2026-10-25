// Country-gated pilot. Configuration is inert until explicit launch approval.
import { createHash, createHmac } from 'node:crypto';
import { alphaCountryApproved, alphaTimeAllowed } from './_alpha-countries.js';

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
export function alphaReady(sender) {
  return alphaCountryApproved(sender.iso)
    && /^[A-Za-z0-9 ]{1,11}$/.test(sender.from || '') && /[A-Za-z]/.test(sender.from || '')
    && (process.env.SMS_UNSUBSCRIBE_SECRET || '').length >= 32
    && !!process.env.SMS_ALPHA_CONSENT_VERSION
    && !!process.env.SMS_ALPHA_WELCOME
    && (process.env.SMS_ALPHA_FOOTER || '').split('{url}').length === 2;
}
export async function prepareAlpha({ to, body, kind, sender }) {
  if (!alphaReady(sender)) throw new Error('alpha launch configuration incomplete');
  if (!alphaTimeAllowed(sender.iso)) throw new Error('alpha destination quiet time; no send');
  if (!['welcome', 'reminder'].includes(kind)) throw new Error('alpha is outbound reminders only');
  const eligibility = await alphaRpc('sms_alpha_eligible', {
    p_phone: to, p_version: process.env.SMS_ALPHA_CONSENT_VERSION,
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
  return (kind === 'welcome' ? process.env.SMS_ALPHA_WELCOME : body) + '\n' + footer;
}
export async function alphaPreflight(dispatchKey, phone) {
  return (await alphaRpc('sms_dispatch_still_allowed', { p_key: dispatchKey, p_phone: phone })) === true;
}
