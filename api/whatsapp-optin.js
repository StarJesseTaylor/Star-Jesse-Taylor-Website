import {waEnabled, waApprovalsReady, makeWaToken, waReserveMicro, WA_SENDER, WA_TEMPLATES} from './reminders/_whatsapp.js';
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
  const phone=normalisePhone(req.body?.phone || '');
  if(!phone.ok) return res.status(400).json({message:'Enter your WhatsApp number with its country code, for example +44.'});
  try { waReserveMicro(senderFor(phone.e164).iso); }
  catch { return res.status(400).json({message:'WhatsApp practice reminders are not available for this country yet. Please use SMS or contact us in Skool.'}); }
  const admission=await admitSmsSignup(req);
  if(!admission.allow) return res.status(admission.unavailable?503:429).json({message:'Signup is temporarily unavailable. Please try again later.'});
  if (!(await waApprovalsReady())) return res.status(503).json({message:'WhatsApp reminders are awaiting approval. Your existing reminders have not changed.'});
  try {
    const token = makeWaToken(req.body?.timezone,phone.e164,name);
    const text = 'I agree to one daily Audacity practice reminder on WhatsApp from Star Jesse Taylor. Reply STOP to stop. JOIN ' + token;
    return res.status(200).json({url:'https://wa.me/'+WA_SENDER.slice(1)+'?text='+encodeURIComponent(text)});
  } catch { return res.status(400).json({message:'Please choose a valid time zone.'}); }
}
