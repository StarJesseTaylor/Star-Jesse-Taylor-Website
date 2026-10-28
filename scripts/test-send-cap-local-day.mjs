import assert from 'node:assert/strict';
for (const key of Object.keys(process.env)) if (/^(SMS_|SUPABASE_|NEXT_PUBLIC_SUPABASE_)/.test(key)) delete process.env[key];
process.env.SUPABASE_URL='https://offline.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='offline';
const now=Date.parse('2026-10-27T15:10:00Z');
Date.now=()=>now;
const midnight='2026-10-27T07:00:00.000Z';
let sends=[];
globalThis.fetch=async input=>{
  const u=new URL(input);
  if(u.pathname.endsWith('/member_channel')) return Response.json([{id:'member'}]);
  assert.ok(u.pathname.endsWith('/message_log'));
  if(u.searchParams.get('select')!=='id') return Response.json([]);
  const since=Date.parse(u.searchParams.get('created_at').slice(4));
  const reminder=u.searchParams.has('line_id');
  const count=sends.filter(s=>s.at>=since && (!reminder||s.reminder)).length;
  return new Response('[]',{headers:{'content-range':`0-0/${count}`}});
};
const {maySend}=await import('../api/reminders/_send-cap.js');
const options={kind:'reminder',dayStartISO:midnight,from:'offline'};
// Yesterday's evening welcome + reminder are within 24h, outside today.
sends=[{at:now-13*3600000},{at:now-13*3600000,reminder:true}];
assert.equal((await maySend('+12025550100',options)).allow,true);
// Today's reminder still prevents another, even when delivered last hour.
sends.push({at:now-2*3600000,reminder:true});
assert.match((await maySend('+12025550100',options)).reason,/reminder\(s\) today/);
sends=[{at:now-2*3600000},{at:now-3*3600000}];
assert.match((await maySend('+12025550100',options)).reason,/2 texts today/);
sends=[{at:now-1000},{at:now-2000}];
assert.match((await maySend('+12025550100',options)).reason,/last hour/);
sends=[];
assert.equal((await maySend('+12025550100',{...options,dayStartISO:'invalid'})).allow,false);
assert.equal((await maySend('+12025550100',{...options,dayStartISO:'2027-01-01'})).allow,false);
console.log('PASS: local-day rollover, daily reminder and total caps, hourly cap, invalid boundaries. Offline only.');
