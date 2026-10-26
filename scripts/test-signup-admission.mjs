import assert from 'node:assert/strict';
for(const k of Object.keys(process.env))if(/^(SUPABASE_|NEXT_PUBLIC_SUPABASE_|ACTIVECAMPAIGN_|SMS_|REMINDERS_)/.test(k))delete process.env[k];
Object.assign(process.env,{SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'offline',ACTIVECAMPAIGN_API_KEY:'offline',REMINDERS_SIGNUP_OPEN:'1'});
const {admitSmsSignup}=await import('../api/reminders/_signup-limit.js');
const {default:signup}=await import('../api/sms-optin.js');
let mode='limit',calls=0,lastBody;
globalThis.fetch=async(url,init)=>{
 assert.equal(url,'https://offline.invalid/rest/v1/rpc/admit_sms_signup');
 calls++;lastBody=JSON.parse(init.body);
 assert.match(lastBody.p_ip_hash,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(lastBody).includes('192.0.2.1'),false);
 if(mode==='timeout')throw new Error('timeout');
 if(mode==='bad')return Response.json({allow:'true'});
 if(mode==='down')return new Response('',{status:503});
 return Response.json(mode==='ok'?{allow:true}:{allow:false,reason:'signup_limit'});
};
const req={method:'POST',headers:{'x-forwarded-for':'192.0.2.1'},body:{firstName:'Test',lastName:'Member',email:'member@example.invalid',phone:'+12025550100',consent:true}};
const res=()=>({code:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;},end(){return this;}});
let r=res();await signup(req,r);assert.equal(r.code,429);assert.equal(calls,1); // No enrollment/CRM/provider calls.
for(mode of ['timeout','bad','down']) {r=res();await signup(req,r);assert.equal(r.code,503);}
mode='ok';assert.equal((await admitSmsSignup(req)).allow,true);
const original=lastBody.p_ip_hash;await admitSmsSignup({...req,body:{ip:'198.51.100.1'}});assert.equal(lastBody.p_ip_hash,original);
const before=calls;r=res();await signup({...req,body:{...req.body,consent:'false'}},r);assert.equal(r.code,400);assert.equal(calls,before);
delete process.env.SUPABASE_SERVICE_ROLE_KEY;assert.equal((await admitSmsSignup(req)).allow,false);
console.log('PASS: rejection precedes all enrollment/CRM/provider writes, unavailable/malformed guard fails closed, IP hashed, body IP ignored, string false rejected. No sends.');
