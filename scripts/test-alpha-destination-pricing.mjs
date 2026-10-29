import assert from 'node:assert/strict';
for(const k of Object.keys(process.env))if(/^(TWILIO_|SUPABASE_|SMS_)/.test(k))delete process.env[k];
Object.assign(process.env,{SMS_ALPHA_GB_ENABLED:'true',SMS_ALPHA_CY_ENABLED:'true',SMS_GEO_CY_READY:'true',SMS_ALPHA_GR_ENABLED:'true'});
Object.assign(process.env,{SMS_ALPHA_IT_ENABLED:'true',SMS_ALPHA_HR_ENABLED:'true',SMS_GEO_HR_READY:'true',SMS_ALPHA_IL_ENABLED:'true',SMS_GEO_IL_READY:'true',SMS_ALPHA_MT_ENABLED:'true',SMS_GEO_MT_READY:'true',SMS_ONEWAY_BE_ENABLED:'true',SMS_GEO_BE_READY:'true'});
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
for (const [iso,type,price] of [['GR','international',.0657],['HR','international',.1379],['IT','mobile',.0927],['IL','mobile',.2575]]) {
  assert.equal(await reserve(iso,[row(type,String(price))]),Math.ceil((price+.001)*1.1*1e6));
  // Published floor cannot replace missing authenticated account data.
  await assert.rejects(()=>reserve(iso,[]),/price unavailable/);
  await assert.rejects(()=>reserve(iso,[row('shortcode','.01')]),/price unavailable/);
  assert.equal(await reserve(iso,[row(type,'.4'),row('alphanumeric','.5')]),Math.ceil(.501*1.1*1e6));
}
await assert.rejects(()=>reserve('GR',[row('mobile','.056')]),/price unavailable/);
await assert.rejects(()=>reserve('MT',[row('international','.1')]),/price unavailable/);
payload=fixture([row('international','.15')]);
const numeric=await import('../api/reminders/_spend.js?numeric=BE');
assert.equal(await numeric.reserveAmount('Check','BE','sms',false,true),Math.ceil(.151*1.1*1e6));
delete process.env.SMS_ALPHA_IL_ENABLED;
await assert.rejects(()=>reserve('IL',[row('mobile','.2575')]),/not approved/);
console.log('PASS: scoped alpha mappings, numeric Belgium, highest rates, missing-price/currency holds, unknown-country and launch gates. No sends.');
