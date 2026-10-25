// Read-only deployment verification. Never sends or changes a reservation.
import {reserveAmount} from './_spend.js';
export default async function handler(req,res) {
  if (req.method!=='GET') return res.status(405).end();
  if (!process.env.CRON_SECRET || req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({error:'Unauthorized'});
  const root=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
  try {
    const r=await fetch(root+'/rest/v1/sms_budget_policy?id=eq.true&select=enabled,daily_micro,monthly_micro',{
      headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},
      signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('unavailable');
    const rows=await r.json();
    const versionReply=await fetch(root+'/rest/v1/rpc/sms_safety_version',{
      method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(10000)});
    const databaseVersion=versionReply.ok?await versionReply.json():null;
    const pricing = await Promise.all(['US','CA','AU','SE','IN','GB'].map(async iso=>{
      try {return {iso,reservedMicro:await reserveAmount('Verification',iso,'sms')};}
      catch {return {iso,error:'pricing unavailable'};}
    }));
    return res.status(200).json({safetyVersion:'2026-10-24-v2',databaseVersion,ready:databaseVersion==='2026-10-24-v2' && rows.length===1 && rows[0].enabled && pricing.every(p=>!p.error),policy:rows[0]||null,pricing});
  } catch {return res.status(503).json({safetyVersion:'2026-10-24-v1',ready:false});}
}
