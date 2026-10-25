// Offline only. Every network request is intercepted; no credentials are loaded.
import assert from 'node:assert/strict';
for (const key of Object.keys(process.env)) {
  if (/^(TWILIO_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|RESEND_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  TWILIO_ACCOUNT_SID: 'offline', TWILIO_AUTH_TOKEN: 'offline',
  TWILIO_FROM_NUMBER: '+12025550100', SUPABASE_URL: 'https://offline.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'offline',
});
let posts = 0;
let mode = 'normal';
let reservations=new Set();
globalThis.fetch = async (url, init = {}) => {
  if(String(url).startsWith('https://pricing.twilio.com/')) return Response.json({price_unit:'usd',outbound_sms_prices:[{prices:[{number_type:'local',current_price:'.0083'}]}]});
  if(String(url).includes('/message_log')) return Response.json([]);
  if (String(url).includes('api.twilio.com')) {
    posts++;
    if (mode === '21612') return Response.json({code:21612,message:'unsupported route'}, {status:400});
    if (mode === 'missingSid') return Response.json({});
    if (mode === 'timeout') throw new Error('timeout');
    return Response.json({sid:'SM'+'a'.repeat(32),status:'queued'});
  }
  if (String(url).startsWith('https://offline.invalid/rest/v1/member_channel')) return Response.json([]);
  if (String(url).includes('/rpc/reserve_sms_dispatch')) {
    const b=JSON.parse(init.body);
    if(reservations.has(b.p_key))return Response.json({allow:false,reason:'duplicate'});
    reservations.add(b.p_key); return Response.json({allow:true});
  }
  if (String(url).includes('/sms_dispatch_reservations') || String(url).includes('/sms_route_holds')) return Response.json([]);
  throw new Error('Unexpected request refused: ' + new URL(url).hostname);
};
const {sendMessage, canReach, senderFor} = await import('../api/reminders/_channel.js');
const results=[];
async function check(name, fn) {
  posts=0; mode='normal'; reservations=new Set();
  try { await fn(); results.push({name,pass:true}); }
  catch(e) { results.push({name,pass:false,error:e.message}); }
}
for (const [iso,phone] of Object.entries({AT:'+436601234567',GB:'+447700900000',IT:'+393331234567',GR:'+306901234567',PH:'+639171234567',AE:'+971501234567',SA:'+966501234567'})) {
  await check(iso+' blocked before any provider request',async()=>{
    const r=await sendMessage({to:phone,body:'offline',channel:'sms'});
    assert.equal(r.blocked,true); assert.equal(r.permanent,true); assert.equal(posts,0);
  });
}
await check('Unknown country signup route check fails closed',()=>assert.equal(canReach('+923001234567').ok,false));
await check('Unknown country stopped at wire',async()=>{
  const r=await sendMessage({to:'+923001234567',body:'offline',channel:'sms'});
  assert.equal(r.blocked,true); assert.equal(posts,0);
});
await check('Canada classified separately from US',()=>{
  // Classification is needed for destination-specific prices, not just routing.
  assert.equal(senderFor('+15875550100').iso,'CA');
});
await check('Actual provider 21612 marked permanent',async()=>{
  mode='21612';
  const r=await sendMessage({to:'+12025550101',body:'offline',channel:'sms',kind:'reminder',dispatchKey:'test'});
  assert.equal(posts,1);
  assert.equal(r.permanent,true);
});
await check('Provider success without SID is not reported sent',async()=>{
  mode='missingSid';
  const r=await sendMessage({to:'+12025550101',body:'offline',channel:'sms',kind:'reminder',dispatchKey:'test'});
  assert.equal(posts,1); assert.equal(r.unknown,true);
  assert.equal(r.sent,false);
});
await check('Concurrent dispatch submits exactly once',async()=>{
  const r=await Promise.all(Array.from({length:12},()=>sendMessage({to:'+12025550101',body:'offline',channel:'sms',kind:'welcome',dispatchKey:'welcome:test'})));
  assert.equal(posts,1); assert.equal(r.filter(x=>x.sent).length,1);
});
const {smsSegments}=await import('../api/reminders/_spend.js');
await check('Timeout never retries the same dispatch',async()=>{
  mode='timeout'; const args={to:'+12025550101',body:'offline',channel:'sms',kind:'reminder',dispatchKey:'timeout'};
  const first=await sendMessage(args); await sendMessage(args);
  assert.equal(first.unknown,true);assert.equal(posts,1);
});
await check('GSM and Unicode segment boundaries',()=>{
  assert.equal(smsSegments('a'.repeat(160)),1); assert.equal(smsSegments('a'.repeat(161)),2);
  assert.equal(smsSegments('^'.repeat(81)),2); assert.equal(smsSegments('🙂'.repeat(36)),2);
});
console.log(JSON.stringify({offline:true,results},null,2));
process.exitCode=results.some(r=>!r.pass)?1:0;

