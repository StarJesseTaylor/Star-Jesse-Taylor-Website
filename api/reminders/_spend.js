import { alertStarThrottled } from './_notify.js';
import { alphaRpc } from './_alpha.js';
import { alphaCountryApproved, numericOneWayApproved } from './_alpha-countries.js';

// Reviewed 2026-10-24 against Twilio country pricing (Claude handover).
// Refresh account-specific prices before sending; retain a conservative fee buffer.
// This bounds this application's reservations, not the whole Twilio invoice.
const RATES = {US:.0128,CA:.017,TR:.0305,PL:.0457,AU:.0515,GB:.056,
  BR:.0599,SE:.0646,CH:.0769,IE:.0779,FR:.0798,IN:.0832,ES:.0875,
  IT:.0927,DE:.112,NL:.1143,IL:.2575,GR:.0657,HR:.1379,
  // Public pricing floors checked 2026-10-25. Authenticated pricing below
  // remains mandatory before reserving or submitting any message.
  PT:.0501,DK:.0592,EE:.0958,LT:.0578,NO:.0697};
const BASIC = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');
const EXT = new Set('\f^{}\\[~]|€');
export function smsSegments(body) {
  if (typeof body !== 'string' || !body.length || body.length > 1600) throw new Error('invalid message length');
  let septets = 0;
  for (const char of body) {
    if (BASIC.has(char)) septets++;
    else if (EXT.has(char)) septets+=2;
    else return Math.ceil(body.length / (body.length <= 70 ? 70 : 67));
  }
  return Math.ceil(septets / (septets <= 160 ? 160 : 153));
}
const priceCache=new Map();
// Explicit destination mappings, not a fallback across every product type.
// GB/CY: authenticated account inspection on 2026-10-26.
// GR/HR/IT/IL: Twilio published SMS pricing reviewed 2026-10-28 shows
// identical alpha and named numeric rates. See docs/alpha-pricing-evidence.md.
// Runtime authenticated pricing is still mandatory; public floors alone NEVER send.
const ALPHA_PRICE_TYPES = Object.freeze({
  GB:['alphanumeric','local','mobile'], CY:['alphanumeric','local','mobile'],
  GR:['alphanumeric','international'], HR:['alphanumeric','international'],
  IT:['alphanumeric','mobile'], IL:['alphanumeric','mobile'],
});
async function currentRate(iso, alpha=false) {
  const cacheKey=iso+':'+(alpha?'alpha':'number');
  const cached=priceCache.get(cacheKey);
  if(cached && Date.now()-cached.at<900000)return cached.price;
  const r=await fetch('https://pricing.twilio.com/v1/Messaging/Countries/'+iso,{
    headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64')},
    signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('current pricing unavailable');
  const data=await r.json();
  if(String(data.price_unit).toLowerCase()!=='usd')throw new Error('unverified pricing currency');
  // Include explicit alpha prices if supplied; reserve the highest eligible
  // carrier price. Unknown destinations still require an explicit alpha row.
  const typesForRoute=alpha
    ? (ALPHA_PRICE_TYPES[iso] || ['alphanumeric'])
    : ['local','mobile','international'];
  const prices=(data.outbound_sms_prices||[]).flatMap(x=>x.prices||[])
    .filter(x=>typesForRoute.includes(x.number_type))
    .map(x=>Number(x.current_price)).filter(x=>Number.isFinite(x)&&x>0);
  if(!prices.length) {
    // Diagnose provider schema mismatches without exposing credentials, phone
    // numbers, or the raw account response. Keep the budget-hold error prefix.
    const types=[...new Set((data.outbound_sms_prices||[]).flatMap(x=>x.prices||[])
      .map(x=>String(x.number_type||'missing').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)))]
      .sort().slice(0,12).join(',') || 'none';
    throw new Error('current destination price unavailable ('+iso+'; '+(alpha?'alpha':'number')+'; types='+types+')');
  }
  const carrier=iso==='US'?.006:iso==='CA'?.009:.001;
  const price=Math.max(RATES[iso] || 0,Math.max(...prices)+carrier);
  priceCache.set(cacheKey,{at:Date.now(),price});return price;
}
export async function reserveAmount(body, iso, channel, alpha=false, oneWayNumeric=false) {
  if (channel !== 'sms') throw new Error('unverified destination price');
  if (alpha && oneWayNumeric) throw new Error('conflicting route pricing');
  if (alpha && !alphaCountryApproved(iso)) throw new Error('alpha pricing not approved for destination');
  // One-way numeric routes have no static floor: the authenticated provider
  // price is the only source, and an unavailable price fails closed.
  if (oneWayNumeric && !numericOneWayApproved(iso)) throw new Error('one-way numeric pricing not approved for destination');
  if (!alpha && !oneWayNumeric && !RATES[iso]) throw new Error('unverified destination price');
  return Math.ceil((await currentRate(iso,alpha)) * 1.1 * smsSegments(body) * 1e6);
}
const root = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/,'');
async function db(path, body, method='POST') {
  if (!root() || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('budget database unavailable');
  const r = await fetch(root()+'/rest/v1/'+path, {method,
    signal: AbortSignal.timeout(10000),
    headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':'application/json', Prefer:'return=representation'+(path.includes('on_conflict=')?',resolution=merge-duplicates':'')},
    body:JSON.stringify(body)});
  if (!r.ok) throw new Error('budget database refused operation');
  return r.status===204 ? null : r.json();
}
export async function reserveSend({dispatchKey,to,from,channel,kind,body,iso,alpha=false,oneWayNumeric=false}) {
  let result;
  try {
    if (!dispatchKey) throw new Error('missing dispatch key');
    // Verify migration availability and suppression before creating any reservation.
    // A missing RPC cannot strand all existing recipients with pending dispatches.
    if ((await alphaRpc('sms_phone_not_suppressed',{p_phone:to})) !== true)
      return {allow:false,reason:'global_suppression'};
    result = await db('rpc/reserve_sms_dispatch', {p_key:dispatchKey,p_phone:to,
      p_sender:from,p_channel:channel,p_kind:kind,p_micro:await reserveAmount(body,iso,channel,alpha,oneWayNumeric)});
    if (result?.allow===true) return result;
  } catch (e) { result={allow:false,reason:e.message}; }
  if (!['duplicate','welcome_already_reserved','phone_daily_limit','route_held'].includes(result?.reason)) {
    await alertStarThrottled({kind:'sms_budget_hold',throttleMinutes:1440,
      subject:'SMS sending paused by the spending safeguard',
      html:'<p>A message was held before submission. Check the SMS budget policy, reservations and current destination prices. No automatic retry can bypass the budget.</p>'}).catch(()=>{});
  }
  return result || {allow:false,reason:'unreadable budget response'};
}
export async function settleSend(dispatchKey, {sid,code,state,from,to,channel}) {
  // Reservations are NEVER refunded automatically: failed or uncertain sends can cost money.
  if (state==='unknown' || String(code)==='21612' || String(code)==='21610' || String(code)==='30034') {
    await db('sms_route_holds?on_conflict=phone,sender,channel',
      {phone:String(code)==='30034'?'*':to,sender:from,channel,released_at:null,error_code:state==='unknown'?'unknown':String(code)},'POST').catch(()=>{});
    await alertStarThrottled({kind:'sms_route_hold:'+from+':'+to,throttleMinutes:1440,
      subject:'SMS route paused and needs review',
      html:'<p>A send for the number ending '+String(to).replace(/\D/g,'').slice(-4)+' was held. Error: '+String(code||'unknown').replace(/[^a-z0-9]/gi,'')+'.</p><p>Check the provider record first. Release the specific sms_route_holds entry after verification. For an uncertain outcome, also mark its reservation reconciled. Keep the dispatch key and reserved amount. Consent was not changed. See SAFETY-OPERATIONS.txt.</p>',
      detail:{last4:String(to).slice(-4),code:code||'unknown'}}).catch(()=>{});
  }
  await db('sms_dispatch_reservations?dispatch_key=eq.'+encodeURIComponent(dispatchKey),
    {state,provider_sid:sid||null,error_code:code?String(code):null},'PATCH').catch(()=>{});
}
