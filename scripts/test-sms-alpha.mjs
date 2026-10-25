// Offline only, no env files and no network. Fake credentials and reserved test numbers.
import assert from 'node:assert/strict';
for (const k of Object.keys(process.env)) if (/^(TWILIO_|SMS_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|RESEND_)/.test(k)) delete process.env[k];
Object.assign(process.env,{TWILIO_ACCOUNT_SID:'offline',TWILIO_AUTH_TOKEN:'offline',TWILIO_FROM_NUMBER:'+12025550100',TWILIO_ALPHA_GB:'TestStar',SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline'});
const {sendMessage,canReach}=await import('../api/reminders/_channel.js');
const {smsSegments,reserveAmount}=await import('../api/reminders/_spend.js');
const {tokenHash}=await import('../api/reminders/_alpha.js');
const {alphaCountryApproved,alphaTimeAllowed}=await import('../api/reminders/_alpha-countries.js');
const {default:unsubscribe}=await import('../api/u.js');
let eligible=true,stopped=false,finalCheck=true,dbDown=false,posts=0,bodySent='',reserved=0,closedState='',missingPrice=true,missingPrecheck=false;
const tokens=new Set(); const keys=new Set();
globalThis.fetch=async(url,init={})=>{
  const u=String(url), b=init.body && init.headers?.['Content-Type']==='application/json'?JSON.parse(init.body):{};
  if(u.includes('pricing.twilio.com'))return Response.json({price_unit:'usd',outbound_sms_prices:[{prices:[{number_type:'mobile',current_price:'.056'},...(missingPrice?[]:[{number_type:'alphanumeric',current_price:'.070'}])]}]});
  if(u.includes('api.twilio.com')){posts++;bodySent=new URLSearchParams(init.body).get('Body');return Response.json({sid:'SM'+'b'.repeat(32)});}
  if(dbDown)throw new Error('offline database');
  if(u.includes('/rpc/sms_phone_not_suppressed')){if(missingPrecheck)return new Response('missing RPC',{status:404});return Response.json(!stopped);}
  if(u.includes('/rpc/sms_alpha_eligible'))return Response.json(eligible&&!stopped);
  if(u.includes('/rpc/register_sms_unsubscribe')){tokens.add(b.p_hash);return Response.json(!stopped);}
  if(u.includes('/rpc/unsubscribe_sms_token')){if(!tokens.has(b.p_hash))return Response.json(false);stopped=true;return Response.json(true);}
  if(u.includes('/rpc/sms_dispatch_still_allowed'))return Response.json(!stopped&&finalCheck);
  if(u.includes('/rpc/reserve_sms_dispatch')){reserved=b.p_micro;if(stopped||keys.has(b.p_key))return Response.json({allow:false,reason:'duplicate'});keys.add(b.p_key);return Response.json({allow:true});}
  if(u.includes('/sms_dispatch_reservations')&&init.method==='PATCH')closedState=b.state;
  if(u.includes('/message_log')||u.includes('/member_channel')||u.includes('/sms_dispatch_reservations')||u.includes('/sms_route_holds'))return Response.json([]);
  throw new Error('Unexpected network request refused');
};
const send=(key,kind='reminder')=>sendMessage({to:'+447700900000',body:'Are you inside of your head?',channel:'sms',kind,dispatchKey:key});
assert.equal(canReach('+447700900000').ok,false,'sender env alone must not enable alpha');
Object.assign(process.env,{SMS_ALPHA_GB_ENABLED:'true',SMS_UNSUBSCRIBE_SECRET:'x'.repeat(48),SMS_ALPHA_CONSENT_VERSION:'test-only',SMS_ALPHA_WELCOME:'TEST ONLY: Star. One way reminders. Cannot reply. Use the link to unsubscribe.',SMS_ALPHA_FOOTER:'Unsubscribe: {url}'});
assert.equal(canReach('+447700900000').ok,true);
eligible=false;assert.equal((await send('ineligible')).sent,false);assert.equal(posts,0);
eligible=true;assert.equal((await send('missing-alpha-price')).sent,false);assert.equal(posts,0);assert.equal(keys.size,0);
missingPrice=false;missingPrecheck=true;assert.equal((await send('missing-migration')).sent,false);assert.equal(keys.size,0);
missingPrecheck=false;const welcome=await send('welcome','welcome');assert.equal(welcome.sent,true);assert(!bodySent.includes('Reply STOP'));assert(welcome.body.includes('[redacted]'));
assert(bodySent.includes(process.env.SMS_ALPHA_WELCOME));
const url=new URL(bodySent.match(/https:\/\/\S+/)[0]);const token=url.searchParams.get('t');
assert.equal(token.length,24);assert(tokens.has(tokenHash(token)));assert(!url.href.includes('447700'));
assert.equal(reserved,Math.ceil((.070+.001)*1.1*smsSegments(bodySent)*1e6),'price alpha and complete body, not cheaper mobile price');
async function hit(method,t=token){let code=200,text='';const headers={};const res={setHeader:(k,v)=>headers[k]=v,status:c=>(code=c,res),send:s=>{text=s;return res;}};await unsubscribe({method,query:{t}},res);return {code,text,headers};}
await hit('GET');assert.equal(stopped,false,'link preview must not unsubscribe');
assert.equal((await hit('POST','a'.repeat(24))).code,400);
assert.equal((await hit('POST')).code,200);assert(stopped);
assert.equal((await hit('POST')).code,200,'repeat opt out is safe');
assert.equal((await send('after-stop')).sent,false);assert.equal(posts,1);
process.env.TWILIO_FROM_GB='+447700900001';
assert.equal((await send('new-route')).sent,false);assert.equal(posts,1,'route change cannot bypass suppression');
delete process.env.TWILIO_FROM_GB;
stopped=false;finalCheck=false;assert.equal((await send('cancelled-during-reservation')).sent,false);assert.equal(posts,1);assert.equal(closedState,'cancelled_preflight');
dbDown=true;assert.equal((await hit('POST')).code,503);assert.equal((await send('database-down')).sent,false);assert.equal(posts,1);
await assert.rejects(()=>reserveAmount('test','IL','sms',true));
for(const iso of ['IT','GR','AT','PH','AE','SA'])assert.equal(alphaCountryApproved(iso),false);
for(const iso of ['IT','GR']){process.env[`SMS_ALPHA_${iso}_ENABLED`]='true';assert.equal(alphaCountryApproved(iso),true);}
for(const iso of ['AT','PH']){process.env[`SMS_ALPHA_${iso}_ENABLED`]='true';assert.equal(alphaCountryApproved(iso),false);process.env[`SMS_ALPHA_${iso}_REGISTRATION_REFERENCE`]='offline-proof';}
assert.equal(alphaCountryApproved('AT'),true);assert.equal(alphaCountryApproved('PH'),false);
process.env.SMS_ALPHA_PH_URL_APPROVAL_REFERENCE='offline-proof';assert.equal(alphaCountryApproved('PH'),true);
for(const iso of ['AE','SA']){process.env[`SMS_ALPHA_${iso}_ENABLED`]='true';assert.equal(alphaCountryApproved(iso),false);}
assert.equal(alphaTimeAllowed('IT',new Date('2026-10-25T12:00:00Z')),false,'Sunday');
assert.equal(alphaTimeAllowed('IT',new Date('2026-10-26T06:59:00Z')),false,'before 08 Rome');
assert.equal(alphaTimeAllowed('IT',new Date('2026-10-26T07:00:00Z')),true,'08 Rome');
assert.equal(alphaTimeAllowed('IT',new Date('2026-10-26T20:00:00Z')),false,'21 Rome');
assert.equal(alphaTimeAllowed('IT',new Date('2026-07-06T06:00:00Z')),true,'summer DST');
const {greetOnce}=await import('../api/reminders/_welcome.js');
let welcomeCalls=0,oldEnough=true;
const welcomeDb=async(path,init={})=>{
  if(path.includes('meta->>kind'))return Response.json([{status:'blocked',meta:{deferred:true,from:'TestStar'},created_at:new Date(Date.now()-(oldEnough?7200000:1000)).toISOString()}]);
  if(init.method==='POST')return Response.json([{id:'offline-claim'}]);
  return Response.json([]);
};
const welcomeSend=async()=>{welcomeCalls++;return {sent:true,sid:'SM'+'c'.repeat(32),from:'TestStar'};};
await greetOnce(welcomeDb,welcomeSend,{memberId:'offline',toE164:'+447700900000',channel:'sms',currentFrom:'TestStar'});
assert.equal(welcomeCalls,1,'deferred welcome can be reconsidered after an hour on same sender');
oldEnough=false;await greetOnce(welcomeDb,welcomeSend,{memberId:'offline',toE164:'+447700900000',channel:'sms',currentFrom:'TestStar'});
assert.equal(welcomeCalls,1,'no per-minute deferred welcome retry');
console.log('PASS: alpha gate, eligibility, approved welcome, token privacy, complete-body alpha pricing, passive GET, POST opt out, idempotence, route change, preflight race, database failure, country restriction. No real sends.');
