import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

// Run before enrollment, so scheduled welcomes cannot bypass a signup hold.
// Vercel overwrites x-forwarded-for. Never trust a body-supplied IP address.
export async function admitSmsSignup(req) {
  const root=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!root||!key)return {allow:false,unavailable:true};
  const raw=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
  const ip=isIP(raw)?raw:'unknown';
  const hash=createHmac('sha256',key).update('sms-signup-ip:'+ip).digest('hex');
  try {
    const r=await fetch(root+'/rest/v1/rpc/admit_sms_signup',{
      method:'POST',signal:AbortSignal.timeout(5000),
      headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify({p_ip_hash:hash})});
    if(!r.ok)return {allow:false,unavailable:true};
    const result=await r.json();
    if(result?.allow===true)return {allow:true};
    if(result?.reason==='signup_limit')return {allow:false,unavailable:false};
  } catch { /* New enrollment waits; existing reminders are unaffected. */ }
  return {allow:false,unavailable:true};
}
