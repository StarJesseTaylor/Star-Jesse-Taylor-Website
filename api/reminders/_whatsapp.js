import templates from './_whatsapp-template-data.js';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { secondsLeftToday } from './_lines.js';
import { alphaRpc } from './_alpha.js';

export const WA_TEMPLATES = templates;
export const WA_CONSENT = 'wa-reminders-v1';
export const WA_SENDER = '+14246229513';
export const waEnabled = () => process.env.WHATSAPP_ENABLED === 'true' && process.env.TWILIO_WHATSAPP_FROM === WA_SENDER;
// Explicit reviewed USD totals (Twilio + Meta), with an expiry. Never borrow SMS or utility rates.
export function waReserveMicro(iso) {
  const pricing = JSON.parse(process.env.WHATSAPP_PRICING_JSON || '{}');
  const rate = pricing.rates?.[iso];
  if (pricing.currency !== 'USD' || !(Date.parse(pricing.validUntil) > Date.now()) || typeof rate !== 'number' || rate <= 0 || rate > 1)
    throw new Error('WhatsApp destination pricing needs review');
  if (iso === 'US') throw new Error('WhatsApp marketing unavailable for US numbers');
  return Math.ceil((rate + .005) * 1.15 * 1e6); // reserve inbound handling allowance too
}
export function waRender(lineId, timezone) {
  const template = WA_TEMPLATES.find(t => t.id === Number(lineId));
  if (!template) throw new Error('WhatsApp template not registered');
  const variables = template.id === 20 ? {'1': secondsLeftToday(timezone).toLocaleString('en-US')} : {};
  return { ...template, variables, rendered: template.body.replace(/\{\{1\}\}/g, variables['1'] || '') };
}
export async function waPrepare({to, lineId, timezone, kind}) {
  if (!waEnabled()) throw new Error('WhatsApp not enabled');
  if (kind !== 'reminder') throw new Error('WhatsApp only sends approved reminders here');
  if (await alphaRpc('wa_has_consent', {p_phone:to}) !== true) throw new Error('WhatsApp consent required');
  const t = waRender(lineId, timezone);
  await checkTemplate(t);
  return t;
}
async function checkTemplate(t) {
  const headers = {Authorization: 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')};
  const read = async suffix => {
    const r = await fetch('https://content.twilio.com/v1/Content/' + t.sid + suffix, {headers, signal:AbortSignal.timeout(10000)});
    if (!r.ok) throw new Error('WhatsApp approval check unavailable: ' + r.status);
    return r.json();
  };
  const [approval, content] = await Promise.all([read('/ApprovalRequests'), read('')]);
  if (approval.whatsapp?.status !== 'approved' || approval.whatsapp?.category !== 'MARKETING') throw new Error('WhatsApp template not approved as marketing: ' + String(approval.whatsapp?.status) + '/' + String(approval.whatsapp?.category));
  if (content.types?.['twilio/text']?.body !== t.body) throw new Error('WhatsApp template differs from reviewed copy');
  if (content.language !== 'en') throw new Error('WhatsApp template language mismatch: ' + String(content.language));
}
// Re-check the whole rotation before enrollment; never move someone onto pending templates.
export async function waApprovalsReady() {
  if (!waEnabled()) return false;
  try {
    for (let i=0;i<WA_TEMPLATES.length;i+=8)
      await Promise.all(WA_TEMPLATES.slice(i,i+8).map(async t => { try { await checkTemplate(t); } catch (e) { console.warn('WhatsApp readiness:', t.name, e.message); throw e; } }));
    return true;
  } catch { return false; }
}
function secret() {
  const s = process.env.SMS_UNSUBSCRIBE_SECRET || process.env.TWILIO_AUTH_TOKEN;
  if (!s || s.length < 32) throw new Error('WhatsApp confirmation unavailable');
  return s;
}
const mac = data => createHmac('sha256', secret()).update('wa-optin-v1:' + data).digest('base64url');
export function makeWaToken(timezone,phone,name='') {
  new Intl.DateTimeFormat('en', {timeZone:timezone}).format();
  if (!/^\+[1-9]\d{7,14}$/.test(phone || '')) throw new Error('Invalid phone');
  const data = Buffer.from(JSON.stringify({tz:timezone,phone,name,nonce:randomBytes(16).toString('hex'), exp:Date.now()+1800000, v:WA_CONSENT})).toString('base64url');
  return data + '.' + mac(data);
}
export function readWaToken(token) {
  if (typeof token !== 'string' || token.length > 1200) throw new Error('Invalid confirmation');
  const [data, signature, extra] = token.split('.');
  const expected = mac(data || '');
  if (extra || !signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) throw new Error('Invalid confirmation');
  const payload = JSON.parse(Buffer.from(data,'base64url').toString());
  if (payload.v !== WA_CONSENT || !(payload.exp > Date.now()) || payload.exp > Date.now()+1800000) throw new Error('Confirmation expired');
  new Intl.DateTimeFormat('en',{timeZone:payload.tz}).format();
  return payload;
}
