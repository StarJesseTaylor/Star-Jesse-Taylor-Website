import {createWaSignupCode} from './reminders/_whatsapp-signup.js';
import {selfServeEnrollmentAllowed} from './reminders/_enrollment.js';
import {waEnabled, waApprovalsReady, waReserveMicro, WA_SENDER, WA_TEMPLATES} from './reminders/_whatsapp.js';
import {normalisePhone,senderFor} from './reminders/_channel.js';
import {admitSmsSignup} from './reminders/_signup-limit.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET') return res.status(200).json({available:await waApprovalsReady(),codeRequired:!!process.env.SMS_ACCESS_CODE,templateVersion:"short-utility-20261106",templateCount:WA_TEMPLATES.length});
  if (req.method !== 'POST') return res.status(405).end();
  if (!waEnabled()) return res.status(503).json({message:'WhatsApp reminders are not ready yet. Please use SMS for now.'});
  if (process.env.SMS_ACCESS_CODE && req.body?.accessCode !== process.env.SMS_ACCESS_CODE) return res.status(403).json({message:'Please enter the community access code.'});
  if (req.body?.consent !== true) return res.status(400).json({message:'Please confirm that you want WhatsApp reminders.'});
  const name=String(req.body?.name || '').trim();
  if(!name || name.length>80 || /[\x00-\x1f\x7f]/.test(name)) return res.status(400).json({message:'Please enter your name as it appears in Skool.'});
  const raw=String(req.body?.phone || '').trim();
  const country=String(req.body?.countryCode || '');
  let number=raw;
  if (/^\d{1,3}$/.test(country) && !raw.startsWith('+') && !raw.startsWith('00')) {
    let national=raw.replace(/[\s().-]/g,'');
    // Italy keeps significant leading zeros; NANP accepts the domestic 1 prefix.
    if(country !== '39') national=national.replace(/^0+/,'');
    if(country === '1' && /^1\d{10}$/.test(national)) national=national.slice(1);
    if(country === '7' && /^8\d{10}$/.test(national)) national=national.slice(1);
    number='+'+country+national;
  }
  const phone=normalisePhone(number);
  if(!phone.ok) return res.status(400).json({message:'Choose your phone number’s country and enter your usual WhatsApp number, or paste the full number starting with +.'});
  try { waReserveMicro(senderFor(phone.e164).iso); }
  catch { return res.status(400).json({message:'WhatsApp practice reminders are not available for this country yet. Please use SMS or contact us in Skool.'}); }
  try {
    if(!await selfServeEnrollmentAllowed(phone.e164)) return res.status(409).json({message:'Reminders for this number require review. Please contact Star in Skool before signing up again.'});
  } catch { return res.status(503).json({message:'We could not check your reminder preferences. Please try again later.'}); }
  const admission=await admitSmsSignup(req);
  if(!admission.allow) return res.status(admission.unavailable?503:429).json({message:'Signup is temporarily unavailable. Please try again later.'});
  if (!(await waApprovalsReady())) return res.status(503).json({message:'WhatsApp reminders are awaiting approval. Your existing reminders have not changed.'});
  try { new Intl.DateTimeFormat('en',{timeZone:req.body?.timezone}).format(); }
  catch { return res.status(400).json({message:'Please choose a valid time zone.'}); }
  try {
    const code = await createWaSignupCode(req.body?.timezone,phone.e164,name);
    const text = 'JOIN ' + code;
    return res.status(200).json({url:'https://wa.me/'+WA_SENDER.slice(1)+'?text='+encodeURIComponent(text)});
  } catch { return res.status(503).json({message:'We could not prepare your WhatsApp signup. Please try again later or contact Star in Skool.'}); }
}
