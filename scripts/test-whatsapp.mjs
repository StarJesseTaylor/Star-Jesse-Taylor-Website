import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
for(const key of Object.keys(process.env)) if(/^(TWILIO|SUPABASE|NEXT_PUBLIC_SUPABASE|RESEND|WHATSAPP|SMS_)/.test(key)) delete process.env[key];
Object.assign(process.env,{TWILIO_ACCOUNT_SID:'offline',TWILIO_AUTH_TOKEN:'x'.repeat(32),TWILIO_WHATSAPP_FROM:'+14246229513',WHATSAPP_ENABLED:'true',SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline',WHATSAPP_PRICING_JSON:JSON.stringify({currency:'USD',validUntil:'2099-01-01',rates:{GB:.06,US:.03}})});
const {WA_TEMPLATES,makeWaToken,readWaToken,waReserveMicro,waRender}=await import('../api/reminders/_whatsapp.js');
const {sendMessage}=await import('../api/reminders/_channel.js');
const {STOP_WORDS}=await import('../api/reminders/inbound.js');
assert.equal(STOP_WORDS.test('Stop overthinking'),false);
assert.equal(STOP_WORDS.test('End of my day was great'),false);
assert.equal(STOP_WORDS.test('stop sending reminders'),true);
const {default:inbound}=await import('../api/reminders/whatsapp-inbound.js');
let approved=true,consent=true,changed=false,sends=[],stops=0,confirmed=0,seen=new Set();
globalThis.fetch=async(url,init={})=>{
 const u=String(url);
 if(u.includes('/Content/')){const sid=u.split('/Content/')[1].split('/')[0];const t=WA_TEMPLATES.find(x=>x.sid===sid);return Response.json(u.endsWith('/ApprovalRequests')?{whatsapp:{status:approved?'approved':'received',category:'MARKETING'}}:{language:'en',types:{'twilio/text':{body:changed?'changed':t.body}}});}
 if(u.includes('/rpc/wa_has_consent'))return Response.json(consent);
 if(u.includes('/rpc/wa_stop')){consent=false;stops++;return Response.json(true);}
 if(u.includes('/rpc/wa_confirm')){confirmed++;return Response.json({ok:true});}
 if(u.includes('/rpc/sms_dispatch_still_allowed')||u.includes('/rpc/sms_phone_not_suppressed'))return Response.json(true);
 if(u.includes('/rpc/reserve_sms_dispatch')){const b=JSON.parse(init.body);if(seen.has(b.p_key))return Response.json({allow:false,reason:'duplicate'});seen.add(b.p_key);return Response.json({allow:true});}
 if(u.includes('api.twilio.com')){sends.push(new URLSearchParams(init.body));return Response.json({sid:'SM'+'a'.repeat(32)});}
 if(u.startsWith('https://offline.invalid/'))return Response.json([]);
 throw Error('Unexpected network '+u);
};
assert.equal(WA_TEMPLATES.length,32);
assert.equal(new Set(WA_TEMPLATES.map(t=>t.sid)).size,32);
const tok=makeWaToken('Europe/London','+447911123456');assert.equal(readWaToken(tok).tz,'Europe/London');assert.throws(()=>readWaToken(tok+'x'));
assert.throws(()=>waReserveMicro('US'));assert.throws(()=>waReserveMicro('XX'));assert.ok(waReserveMicro('GB')>60000);
assert.ok(!waRender(20,'Europe/London').rendered.includes('{{'));assert.equal(waRender(13,'Europe/London').rendered,"No brain. We're doing this right now.");
const args={to:'+447911123456',channel:'whatsapp',kind:'reminder',lineId:20,timezone:'Europe/London',dispatchKey:'test:1',dayStartISO:'2026-01-01T00:00:00Z'};
approved=false;assert.equal((await sendMessage(args)).blocked,true);assert.equal(sends.length,0);
approved=true;changed=true;assert.equal((await sendMessage(args)).blocked,true);changed=false;
consent=false;assert.equal((await sendMessage(args)).blocked,true);consent=true;
await sendMessage(args);assert.equal(sends.length,1);assert.equal(sends[0].has('Body'),false);assert.equal(sends[0].get('ContentSid'),WA_TEMPLATES.find(t=>t.id===20).sid);assert.ok(JSON.parse(sends[0].get('ContentVariables'))['1']);
await sendMessage(args);assert.equal(sends.length,1);
const req={method:'POST',url:'/api/reminders/whatsapp-inbound',headers:{host:'starjessetaylor.com'},body:{From:'whatsapp:+447911123456',To:'whatsapp:+14246229513',MessageSid:'SM'+'b'.repeat(32),Body:'STOP'}};
function signed(){let s='https://starjessetaylor.com'+req.url;for(const k of Object.keys(req.body).sort())s+=k+req.body[k];req.headers['x-twilio-signature']=createHmac('sha1',process.env.TWILIO_AUTH_TOKEN).update(s).digest('base64');}
const res={setHeader(){},status(n){this.code=n;return this},send(s){this.body=s;return this}};
await inbound(req,res);assert.equal(res.code,403);assert.equal(stops,0);
signed();await inbound(req,res);assert.equal(stops,1);assert.equal(consent,false);
assert.equal((await sendMessage({...args,dispatchKey:'test:2'})).blocked,true);
req.body.Body='I agree to one daily Audacity practice reminder on WhatsApp from Star Jesse Taylor. Reply STOP to stop. JOIN '+tok;req.body.MessageSid='SM'+'c'.repeat(32);signed();await inbound(req,res);assert.equal(confirmed,1);
console.log('WhatsApp tests passed: 32 mappings, signed consent, approval and content guards, template payload, duplicate prevention, STOP, forged webhook rejection.');

assert.equal(readWaToken(makeWaToken('Europe/London','+447700900999','Test Member')).name,'Test Member');
assert.equal(readWaToken(makeWaToken('Europe/London','+447700900999','\u754c'.repeat(80))).name,'\u754c'.repeat(80));
