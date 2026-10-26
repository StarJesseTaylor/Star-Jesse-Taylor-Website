import assert from 'node:assert/strict';
for(const k of Object.keys(process.env))if(/^(TWILIO_|SUPABASE_|SMS_)/.test(k))delete process.env[k];
Object.assign(process.env,{SMS_ALPHA_GB_ENABLED:'true',SMS_ALPHA_CY_ENABLED:'true',SMS_GEO_CY_READY:'true',SMS_ALPHA_GR_ENABLED:'true'});
let payload, calls=0;
globalThis.fetch=async url=>{
  assert.ok(String(url).startsWith('https://pricing.twilio.com/v1/Messaging/Countries/'));
  calls++;
  return Response.json(payload);
};
const fixture=(prices,currency='USD')=>({price_unit:currency,outbound_sms_prices:[{prices}]});
const row=(number_type,current_price)=>({number_type,current_price});
async function reserve(iso,prices,currency='USD'){
  payload=fixture(prices,currency);
  const mod=await import('../api/reminders/_spend.js?case='+calls);
  return mod.reserveAmount('Check',iso,'sms',true);
}
assert.equal(await reserve('GB',[row('mobile','.056'),row('local','.056'),row('shortcode','.0524')]),62701);
assert.equal(await reserve('CY',[row('mobile','.0864'),row('local','.0864')]),96141);
assert.equal(await reserve('GB',[row('mobile','.1'),row('local','.2'),row('alphanumeric','.3')]),331100);
await assert.rejects(()=>reserve('GB',[]),/price unavailable/);
await assert.rejects(()=>reserve('GB',[row('shortcode','.0524')]),/price unavailable/);
await assert.rejects(()=>reserve('GB',[row('mobile','garbage')]),/price unavailable/);
await assert.rejects(()=>reserve('GB',[row('mobile','.056')],'EUR'),/currency/);
await assert.rejects(()=>reserve('GR',[row('mobile','.056')]),/price unavailable/);
console.log('PASS: verified GB/CY payloads, highest rate, currency and missing-price holds, no unverified-country fallback. No sends.');
