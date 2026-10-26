// Offline only: fake credentials, reserved/test-shaped numbers, every network call mocked.
// Covers the 25 Oct 2026 one-way member-country expansion (9 alpha + 2 numeric).
import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const k of Object.keys(process.env)) if (/^(TWILIO_|SMS_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|RESEND_|ACTIVECAMPAIGN_|REMINDERS_)/.test(k)) delete process.env[k];
Object.assign(process.env,{TWILIO_ACCOUNT_SID:'offline',TWILIO_AUTH_TOKEN:'offline',TWILIO_FROM_NUMBER:'+12025550100',
  TWILIO_WHATSAPP_FROM:'+12025550199',SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline'});

const ALPHA = {AL:'+355691234567',ME:'+38267123456',MK:'+38970123456',SI:'+38640123456',HR:'+385911234567',
  HU:'+36201234567',MT:'+35679123456',PE:'+51912345678',CY:'+35799123456'};
const NUMERIC = {BE:'+32470123456',CO:'+573001234567'};
const IDENTITY = new Set(['HR','HU','PE','BE','CO']);
const ALL = {...ALPHA,...NUMERIC};
const REMINDER = 'Are you inside of your head?';

let eligible=true,stopped=false,priceMode='ok';const posts=[];const reserved={};const keys=new Set();const eligibilityCalls=[];
globalThis.fetch=async(url,init={})=>{
  const u=String(url), b=init.body && init.headers?.['Content-Type']==='application/json'?JSON.parse(init.body):{};
  if(u.includes('pricing.twilio.com')){
    const prices=priceMode==='none'?[]:[{number_type:'mobile',current_price:'.05'},{number_type:'international',current_price:'.09'},
      ...(priceMode==='no-alpha'?[]:[{number_type:'alphanumeric',current_price:'.07'}])];
    return Response.json({price_unit:'usd',outbound_sms_prices:[{prices}]});
  }
  if(u.includes('api.twilio.com')){const p=new URLSearchParams(init.body);posts.push({to:p.get('To'),from:p.get('From'),body:p.get('Body')});return Response.json({sid:'SM'+'d'.repeat(32)});}
  if(u.includes('/rpc/sms_phone_not_suppressed'))return Response.json(!stopped);
  if(u.includes('/rpc/sms_alpha_eligible')){eligibilityCalls.push(b);return Response.json(eligible&&!stopped);}
  if(u.includes('/rpc/register_sms_unsubscribe'))return Response.json(!stopped);
  if(u.includes('/rpc/sms_dispatch_still_allowed'))return Response.json(!stopped);
  if(u.includes('/rpc/reserve_sms_dispatch')){if(keys.has(b.p_key))return Response.json({allow:false,reason:'duplicate'});keys.add(b.p_key);reserved[b.p_key]=b.p_micro;return Response.json({allow:true});}
  if(u.includes('/message_log')||u.includes('/member_channel')||u.includes('/sms_dispatch_reservations')||u.includes('/sms_route_holds'))return Response.json([]);
  throw new Error('Unexpected network request refused: '+u);
};

const {sendMessage,canReach,senderFor}=await import('../api/reminders/_channel.js');
const {smsSegments,reserveAmount}=await import('../api/reminders/_spend.js');
const {ALPHA_CONSENT_VERSIONS,alphaCountryApproved,numericOneWayApproved}=await import('../api/reminders/_alpha-countries.js');
let n=0;const send=(to,kind='reminder',channel='sms')=>sendMessage({to,body:REMINDER,channel,kind,dispatchKey:'k'+(++n)});

// 1. Everything off by default; sender env alone enables nothing.
for (const iso of Object.keys(ALPHA)) process.env[`TWILIO_ALPHA_${iso}`]='StarTaylor';
process.env.TWILIO_ALPHA_BE='StarTaylor'; // must NOT turn BE into an alpha route
for (const [iso,to] of Object.entries(ALL)) assert.equal(canReach(to).ok,false,iso+' off by default');
for (const [iso,to] of Object.entries(ALPHA)) assert.equal(senderFor(to).alpha,true,iso+' alpha sender');
for (const [iso,to] of Object.entries(NUMERIC)) {const s=senderFor(to);assert.equal(s.alpha,false,iso+' no alpha bypass');assert.equal(s.oneWay,'numeric');assert.equal(s.from,'+12025550100');}

// 2. Shared one-way config, launch flags, geo gate.
Object.assign(process.env,{SMS_UNSUBSCRIBE_SECRET:'x'.repeat(48),SMS_ALPHA_WELCOME:"You're in. You will get one text reminder a day to stay on track with the practice.",SMS_ALPHA_FOOTER:'Stop anytime: {url}'});
for (const iso of Object.keys(ALPHA)) process.env[`SMS_ALPHA_${iso}_ENABLED`]='true';
for (const iso of Object.keys(NUMERIC)) process.env[`SMS_ALPHA_${iso}_ENABLED`]='true'; // wrong flag for a numeric route
for (const [iso,to] of Object.entries(ALL)) assert.equal(canReach(to).ok,false,iso+' needs geo gate');
for (const iso of Object.keys(ALL)) process.env[`SMS_GEO_${iso}_READY`]='true';
for (const [iso,to] of Object.entries(NUMERIC)) assert.equal(canReach(to).ok,false,iso+' alpha flag cannot open a numeric route');
for (const iso of Object.keys(NUMERIC)) {assert.equal(alphaCountryApproved(iso),false);process.env[`SMS_ONEWAY_${iso}_ENABLED`]='true';assert.equal(numericOneWayApproved(iso),true);}
for (const [iso,to] of Object.entries(ALL)) assert.equal(canReach(to).ok,!IDENTITY.has(iso),iso+' identity required only where sender is rewritten');
process.env.SMS_ONEWAY_IDENTITY='StarTaylor';
for (const [iso,to] of Object.entries(ALL)) assert.equal(canReach(to).ok,true,iso+' ready');

// 3. Pricing fails closed: no alpha price, no numeric price, no guessed floor.
priceMode='no-alpha';assert.equal((await send(ALPHA.HU)).sent,false);
priceMode='none';assert.equal((await send(NUMERIC.CO)).sent,false);
assert.equal(posts.length,0);assert.equal(Object.keys(reserved).length,0);
await assert.rejects(()=>reserveAmount('x','BE','sms',true,false),/approved/,'BE has no alpha pricing path');
await assert.rejects(()=>reserveAmount('x','ZA','sms',false,true),/approved/,'ZA has no one-way pricing path');
priceMode='ok';

// 4. Consent/paid gate.
eligible=false;assert.equal((await send(ALPHA.AL)).sent,false);assert.equal(posts.length,0);eligible=true;

// 5. Each of the 11 sends with the right sender, identity, footer and price.
for (const [iso,to] of Object.entries(ALL)) {
  const before=posts.length;const out=await send(to,'reminder');
  assert.equal(out.sent,true,iso+' sends');assert.equal(posts.length,before+1);
  const p=posts.at(-1);
  assert.equal(p.from,ALPHA[iso]?'StarTaylor':'+12025550100',iso+' sender');
  const expectStart=(IDENTITY.has(iso)?'StarTaylor: ':'')+REMINDER;
  assert(p.body.startsWith(expectStart+'\nStop anytime: https://starjessetaylor.com/api/u?t='),iso+' body '+p.body);
  assert(!p.body.includes('Reply STOP'),iso+' never promises STOP');
  assert(out.body.includes('[redacted]'),iso+' token redacted in logs');
  const unit=(ALPHA[iso]?.07:.09)+.001;
  assert.equal(reserved['k'+n],Math.ceil(unit*1.1*smsSegments(p.body)*1e6),iso+' prices full body on its own route type');
  assert.equal(eligibilityCalls.at(-1).p_version,ALPHA_CONSENT_VERSIONS[iso],iso+' consent version');
}
const welcome=await send(NUMERIC.BE,'welcome');assert.equal(welcome.sent,true);
assert(posts.at(-1).body.startsWith("StarTaylor: You're in."),'welcome identity for rewritten sender');

// 6. Global opt-out holds across routes, including a later local number.
stopped=true;const held=posts.length;
assert.equal((await send(NUMERIC.BE)).sent,false);assert.equal((await send(ALPHA.HU)).sent,false);
process.env.TWILIO_FROM_HU='+3612345678';assert.equal((await send(ALPHA.HU)).sent,false,'route change cannot bypass opt-out');
delete process.env.TWILIO_FROM_HU;assert.equal(posts.length,held);stopped=false;

// 7. Existing two-way numeric routes unchanged: no footer, no identity, US sender.
const NUMERIC19={US:'+12025550123',CA:'+15875550123',AU:'+61412345678',SE:'+46701234567',IN:'+919812345678',IE:'+353861234567',
  DE:'+491511234567',ES:'+34612345678',NL:'+31612345678',CH:'+41791234567',NO:'+4791234567',FR:'+33612345678',TR:'+905321234567',
  PL:'+48512345678',BR:'+5511912345678',PT:'+351912345678',DK:'+4520123456',EE:'+37251234567',LT:'+37061234567'};
for (const [iso,to] of Object.entries(NUMERIC19)) {
  assert.equal(canReach(to).ok,true,iso+' still reachable');const s=senderFor(to);assert.equal(s.oneWay,undefined);assert.equal(s.alpha,false);
}
const eligibleBefore=eligibilityCalls.length;assert.equal((await send(NUMERIC19.DE)).sent,true);
assert.equal(posts.at(-1).body,REMINDER,'two-way body unchanged');assert.equal(posts.at(-1).from,'+12025550100');
assert.equal(eligibilityCalls.length,eligibleBefore,'two-way route skips one-way eligibility');

// 8. WhatsApp behaviour unchanged from HEAD: no verified price, so the spend guard
// blocks it before any post, and it never takes a one-way route or footer.
const waBefore=posts.length;const wa=await send(NUMERIC.BE,'reminder','whatsapp');
assert.equal(wa.sent,false);assert.match(wa.error,/unverified destination price/);assert.equal(posts.length,waBefore);

// 9. Excluded countries stay closed even with every flag a typo could set.
const EXCLUDED={ZA:'+27821234567',MX:'+525512345678',CZ:'+420601123456',NZ:'+64211234567',ID:'+628123456789',AE:'+971501234567',SA:'+966501234567',AT:'+436641234567',PH:'+639171234567'};
for (const iso of Object.keys(EXCLUDED)) Object.assign(process.env,{[`TWILIO_ALPHA_${iso}`]:'StarTaylor',[`SMS_ALPHA_${iso}_ENABLED`]:'true',[`SMS_ONEWAY_${iso}_ENABLED`]:'true',[`SMS_GEO_${iso}_READY`]:'true'});
for (const [iso,to] of Object.entries(EXCLUDED)) assert.equal(canReach(to).ok,false,iso+' stays excluded');
for (const to of ['+77011234567','+233201234567']) assert.equal(canReach(to).ok,false,'KZ/GH stay excluded');

// 10. Consent versions agree across page, server map and SQL.
const html=fs.readFileSync(new URL('../sms.html',import.meta.url),'utf8');
const pairs=[...html.match(/const match = (\[\[.*?\]\])\.find/)[1].matchAll(/\['(\d+)','([a-z]+)'\]/g)].map(m=>[m[1],m[2]]);
const sql=fs.readFileSync(new URL('../sql/sms_alpha_member_countries.sql',import.meta.url),'utf8');
for (const [iso,to] of Object.entries(ALL)) {
  const v=ALPHA_CONSENT_VERSIONS[iso];assert(v&&v.startsWith(iso.toLowerCase()+'-one-way-'),iso+' server version');
  const page=pairs.find(([d])=>to.slice(1).startsWith(d));assert.equal(page?.[1]+'-one-way-2026-10-25',v,iso+' page version');
  assert(sql.includes(`then '${v}'`),iso+' SQL version');
}
assert(!pairs.some(([,c])=>['at','ph','za','mx','ae','sa'].includes(c)),'no consent path for excluded countries');

// 11. Signup records the exact country version and rejects a mismatch.
process.env.ACTIVECAMPAIGN_API_KEY='offline';process.env.ACTIVECAMPAIGN_API_URL='https://ac.invalid';process.env.REMINDERS_SIGNUP_OPEN='1';process.env.REMINDERS_LIVE='0';
const {default:optin}=await import('../api/sms-optin.js');
let calls=[];
globalThis.fetch=async(url,init={})=>{calls.push([String(url),init]);const u=String(url);
  if(u.includes('/rpc/admit_sms_signup'))return Response.json({allow:true});
  if(u.includes('/rpc/sms_phone_not_suppressed'))return Response.json(true);
  if(u.includes('/rpc/record_alpha_sms_consent'))return Response.json(true);
  if(u.includes('member_channel?phone='))return Response.json([{id:'offline-member',status:'active',consent_at:new Date().toISOString()}]);
  if(u.includes('offline.invalid'))return Response.json([]);
  if(u.includes('/contact/sync'))return Response.json({contact:{id:'offline'}});
  if(u.includes('ac.invalid'))return Response.json({tags:[],tag:{id:'offline'}});
  if(u.includes('api.resend.com'))return Response.json({id:'offline'});
  throw new Error('Unexpected network destination: '+u);};
const run=async body=>{const res={setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}};
  await optin({method:'POST',body:{email:'offline@example.invalid',firstName:'Test',lastName:'Member',consent:true,...body}},res);return res;};
for (const [iso,to] of Object.entries(ALL)) {
  calls=[];let r=await run({phone:to,alphaConsentVersion:ALPHA_CONSENT_VERSIONS[iso]});assert.equal(r.code,200,iso+' signup');
  assert(calls.some(x=>x[0].includes('record_alpha_sms_consent')&&JSON.parse(x[1].body).p_version===ALPHA_CONSENT_VERSIONS[iso]),iso+' consent recorded');
  calls=[];r=await run({phone:to,alphaConsentVersion:'uk-one-way-2026-10-25'});assert.equal(r.code,400,iso+' wrong notice rejected');assert.equal(calls.length,0);
}
console.log('PASS: 11 one-way countries (9 alpha, 2 numeric): off by default, launch+geo gates, no alpha bypass, identity where rewritten, alpha vs numeric pricing, fail-closed pricing, consent/paid gate, opt-out across routes, 19 two-way routes unchanged, WhatsApp unchanged (fail-closed), exclusions held, page/server/SQL consent versions agree, signup consent. No real sends.');
