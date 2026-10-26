import assert from 'node:assert/strict';
process.env.ACTIVECAMPAIGN_API_KEY='offline';process.env.ACTIVECAMPAIGN_API_URL='https://ac.invalid';process.env.SUPABASE_URL='https://db.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='offline';process.env.REMINDERS_SIGNUP_OPEN='1';process.env.REMINDERS_LIVE='0';delete process.env.RESEND_API_KEY;
const {default:handler}=await import('../api/sms-optin.js');
let consentOK=true,acOK=false,calls=[];
globalThis.fetch=async(url,init={})=>{calls.push([String(url),init]);
 if(String(url).includes('/rpc/admit_sms_signup'))return Response.json({allow:true});
 if(String(url).includes('/rpc/sms_phone_not_suppressed'))return Response.json(true);
 if(String(url).includes('/rpc/record_alpha_sms_consent'))return consentOK?Response.json(true):Response.json({}, {status:503});
 if(String(url).includes('member_channel?phone='))return Response.json([{id:'offline-member',status:'active',consent_at:new Date().toISOString()}]);
 if(String(url).includes('db.invalid'))return Response.json([]);
 if(String(url).includes('/contact/sync'))return Response.json({contact:{id:'offline'}},{status:acOK?200:503});
 if(String(url).includes('ac.invalid'))return Response.json({tags:[],tag:{id:'offline'}});
 throw new Error('Unexpected network destination: '+url);
};
const run=async(extra={})=>{const res={setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}};await handler({method:'POST',body:{email:'offline@example.invalid',firstName:'Test',lastName:'Member',phone:'+447700900000',consent:true,alphaConsentVersion:'uk-one-way-2026-10-25',...extra}},res);return res;};
let r=await run();assert.equal(r.code,200);assert.equal(r.body.crm,false);assert(calls.findIndex(x=>x[0].includes('record_alpha_sms_consent'))<calls.findIndex(x=>x[0].includes('/contact/sync')));
consentOK=false;acOK=true;calls=[];r=await run();assert.equal(r.code,503);assert(calls.some(x=>x[0].includes('/contact/sync')&&JSON.parse(x[1].body).contact.phone==='+447700900000'),'phone still reaches CRM after consent failure');
calls=[];r=await run({alphaConsentVersion:''});assert.equal(r.code,400);assert.equal(calls.length,0,'no writes with missing disclosure');
consentOK=true;calls=[];r=await run({phone:'',consent:false});assert.equal(r.code,200);assert(!calls.some(x=>x[0].includes('record_alpha_sms_consent')),'email only unchanged');
for (const [phone,version] of [['+393331234567','it'],['+306912345678','gr']]) {
 calls=[];r=await run({phone,alphaConsentVersion:version+'-one-way-2026-10-25'});assert.equal(r.code,200);
 assert(calls.some(x=>x[0].includes('record_alpha_sms_consent')&&JSON.parse(x[1].body).p_version===version+'-one-way-2026-10-25'));
 calls=[];r=await run({phone,alphaConsentVersion:'uk-one-way-2026-10-25'});assert.equal(r.code,400);assert.equal(calls.length,0);
}
console.log('PASS: UK consent survives CRM outage, failed consent still syncs phone but does not report success, missing notice prevents writes, email-only signup works. No real network.');
