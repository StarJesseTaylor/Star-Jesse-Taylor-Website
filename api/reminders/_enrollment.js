// Self-service enrollment may create a new record or reuse an active one only.
// Preserve stopped, paused and future non-active states; database RPC checks again.
export async function selfServeEnrollmentAllowed(phone) {
  const root=(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!root || !key) throw new Error('Enrollment status unavailable');
  const r=await fetch(root+'/rest/v1/member_channel?phone=eq.'+encodeURIComponent(phone)+'&select=status',{
    headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
  if(!r.ok) throw new Error('Enrollment status unavailable');
  const rows=await r.json();
  if(!Array.isArray(rows)) throw new Error('Enrollment status unavailable');
  return rows.every(row=>row.status==='active');
}
