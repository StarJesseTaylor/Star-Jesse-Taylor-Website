import assert from 'node:assert/strict';
for(const k of Object.keys(process.env))if(/^(TWILIO_|SUPABASE_|RESEND_)/.test(k))delete process.env[k];
process.env.TWILIO_FROM_NUMBER='+12025550100';
process.env.TWILIO_ACCOUNT_SID='offline';process.env.TWILIO_AUTH_TOKEN='offline';
const {canReach}=await import('../api/reminders/_channel.js');
let mode='ok', requests=0;
globalThis.fetch=async url=>{
 assert.ok(String(url).startsWith('https://pricing.twilio.com/'));
 requests++;
 if(mode==='fail')return new Response('',{status:503});
 return Response.json({price_unit:mode==='currency'?'eur':'usd',outbound_sms_prices:[{prices:mode==='empty'?[]:[
  {number_type:'international',current_price:'.20'},
  {number_type:'mobile',current_price:'.10'}]}]});
};
const {reserveAmount}=await import('../api/reminders/_spend.js');
for(const phone of ['+351912345678','+4512345678','+37251234567','+37061234567','+4791234567','+31612345678'])assert.equal(canReach(phone).ok,true);
for(const phone of ['+64211234567','+6591234567','+40712345678','+359881234567','+51912345678','+447700900000'])assert.equal(canReach(phone).ok,false);
assert.equal(await reserveAmount('Check','PT','sms'),221101);
mode='fail';await assert.rejects(()=>reserveAmount('Check','DK','sms'),/pricing unavailable/);
mode='currency';await assert.rejects(()=>reserveAmount('Check','EE','sms'),/currency/);
mode='empty';await assert.rejects(()=>reserveAmount('Check','LT','sms'),/price unavailable/);
mode='ok';assert.equal(await reserveAmount('Check','NO','sms'),221101);
await assert.rejects(()=>reserveAmount('Check','NZ','sms'),/unverified destination/);
assert.equal(requests,5);
console.log('PASS: routes, continued holds, highest numeric carrier rate, and fail-closed pricing; no sends.');

