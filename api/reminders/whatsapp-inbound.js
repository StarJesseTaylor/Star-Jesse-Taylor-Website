import {confirmWaSignupCode} from './_whatsapp-signup.js';
import {selfServeEnrollmentAllowed} from './_enrollment.js';
import inbound, {STOP_WORDS} from './inbound.js';
import {verifyTwilio} from './_twilio-sig.js';
import {alphaRpc} from './_alpha.js';
import {waEnabled,waApprovalsReady,readWaToken,waReserveMicro,WA_CONSENT,WA_SENDER} from './_whatsapp.js';
import {senderFor} from './_channel.js';
import {reserveSend,settleSend} from './_spend.js';
const xml = text => '<?xml version="1.0" encoding="UTF-8"?><Response>'+(text?'<Message>'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</Message>':'')+'</Response>';
export default async function handler(req,res) {
  res.setHeader('Content-Type','text/xml');
  if (req.method !== 'POST' || !verifyTwilio(req).ok) return res.status(403).send(xml());
  const from = String(req.body?.From || '');
  const to = String(req.body?.To || '');
  const sid = String(req.body?.MessageSid || '');
  const body = String(req.body?.Body || '').trim();
  if (!/^whatsapp:\+[1-9]\d{7,14}$/.test(from) || to !== 'whatsapp:'+WA_SENDER || !/^SM[0-9a-f]{32}$/i.test(sid)) return res.status(400).send(xml());
  const phone = from.slice(9);
  const reply = async text => {
    const key='reply:'+sid;
    const r=await reserveSend({dispatchKey:key,to:phone,from:WA_SENDER,channel:'whatsapp',kind:'reply',body:text,iso:senderFor(phone).iso});
    if(!r.allow) return res.status(200).send(xml());
    await settleSend(key,{state:'twiml_returned',from:WA_SENDER,to:phone,channel:'whatsapp'});
    return res.status(200).send(xml(text));
  };
  try {
    if (STOP_WORDS.test(body)) {
      await alphaRpc('wa_stop',{p_phone:phone,p_sid:sid});
      return reply('Your WhatsApp reminders are stopped. To sign up again, visit https://starjessetaylor.com/whatsapp');
    }
    const shortJoin=body.match(/^JOIN ([A-Za-z0-9_-]{11})$/);
    if(shortJoin) {
      if(!waEnabled() || !(await waApprovalsReady())) return reply('WhatsApp reminders are not ready yet. Your existing SMS preference has not changed. Please try again later.');
      if(!await selfServeEnrollmentAllowed(phone)) return reply('Reminders for this number require review. Please contact Star in Skool before signing up again.');
      try { waReserveMicro(senderFor(phone).iso); } catch { return res.status(200).send(xml()); }
      const result=await confirmWaSignupCode(shortJoin[1],phone,sid);
      if(result?.duplicate) return res.status(200).send(xml());
      if(!result?.ok) return reply('Your signup code is expired or cannot be used. Please open starjessetaylor.com/whatsapp again, or contact Star in Skool for help.');
      return reply('You are signed up for daily Audacity reminders on WhatsApp. Future reminders will use WhatsApp. An SMS already sent may still arrive. One reminder a day, between 8am and 9pm in your time zone. Reply STOP to stop. This is an automated reminder line. For support, visit the community: https://www.skool.com/starjessetaylor');
    }
    // Accept previously issued signed links until their existing 30-minute expiry.
    const join=body.match(/^I agree to one daily Audacity practice reminder on WhatsApp from Star Jesse Taylor\. Reply STOP to stop\. JOIN ([A-Za-z0-9_.-]+)$/);
    if (join) {
      if (!waEnabled() || !(await waApprovalsReady())) return reply('WhatsApp reminders are not ready yet. Your existing SMS preference has not changed. Please try again later.');
      let payload;
      try { payload=readWaToken(join[1]); } catch { return reply('Please open starjessetaylor.com/whatsapp again to confirm your reminders.'); }
      if(payload.phone !== phone) return reply('Please use the same WhatsApp number you entered on the signup page.');
      if(!await selfServeEnrollmentAllowed(phone)) return reply('Reminders for this number require review. Please contact Star in Skool before signing up again.');
      // Only admit destinations with reviewed costs. No silent SMS fallback.
      try { waReserveMicro(senderFor(phone).iso); } catch { return res.status(200).send(xml()); }
      const result=await alphaRpc('wa_confirm',{p_phone:phone,p_timezone:payload.tz,p_sid:sid,p_version:WA_CONSENT,p_name:String(payload.name || req.body?.ProfileName || '').slice(0,80),p_nonce:payload.nonce});
      if(result?.duplicate) return res.status(200).send(xml());
      if(!result?.ok) return reply('We could not activate reminders for this number. Please contact Star in Skool for help.');
      return reply('You are signed up for daily Audacity reminders on WhatsApp. Future reminders will use WhatsApp. An SMS already sent may still arrive. One reminder a day, between 8am and 9pm in your time zone. Reply STOP to stop. This is an automated reminder line. For support, visit the community: https://www.skool.com/starjessetaylor');
    }
    if (/^(start|unstop|resume|yes please)\b/i.test(body)) return reply('To restart WhatsApp reminders, confirm at https://starjessetaylor.com/whatsapp');
    return inbound(req,res);
  } catch { return res.status(503).send(xml()); }
}
