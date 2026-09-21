// ABUSE PROTECTION FOR THE SIGNUP DOOR.
//
// THE ATTACK THIS STOPS
// ---------------------
// Toll fraud, also called SMS pumping. Someone controls a phone network in a
// country where receiving a text is expensive. They bot a public form that
// sends a text on submit, thousands of times, with numbers on their own
// network. The operator keeps a cut and shares it with them. The business gets
// a bill for texts nobody read, and its number gets a traffic pattern that
// carriers can suspend an A2P campaign over.
//
// /sms is exactly that shape: it sends a welcome text the moment someone
// submits. Before this file there was no rate limit anywhere in api/.
//
// THE DESIGN DECISION THAT MATTERS
// --------------------------------
// We cap the TEXTS, not the SIGNUPS.
//
// A signup costs nothing: a database row and an ActiveCampaign contact. The
// welcome TEXT is the only thing that spends money. So under attack, people
// still get signed up and nothing is lost, we simply stop sending the hello
// and tell Star. A legitimate person is never turned away by a fraudster, and
// the fraudster earns zero.
//
// TWO LAYERS
//   1. A GLOBAL hourly ceiling. This is the one that actually bounds the
//      damage, because it holds no matter how many IPs or numbers an attacker
//      rotates through.
//   2. A per-instance memory of recent IPs. Cheap, catches the naive flood
//      early, and is deliberately NOT relied on: serverless spreads requests
//      across instances and proxies are trivial to rotate. It narrows the
//      window, the global cap is the wall.

const SB_URL = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * How many welcome texts may leave in any rolling hour, across everyone.
 * Ten real testers generate ten. A Skool post might generate thirty in a good
 * hour. Anything past this is not humans reading a post.
 * Override with SIGNUP_TEXTS_PER_HOUR if a launch ever needs more.
 */
const GLOBAL_PER_HOUR = Number(process.env.SIGNUP_TEXTS_PER_HOUR || 40);

/** Per-IP ceiling in the same window. A household sharing an IP might do 2-3. */
const PER_IP_PER_HOUR = 5;

// Module scope: survives warm invocations on one instance, resets on cold
// start. Intentionally small and lossy — see the note above.
const recentByIp = new Map();

function clientIp(req) {
  const h = req.headers || {};
  const fwd = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(h['x-real-ip'] || '') || 'unknown';
}

/** Trim anything older than an hour so the map cannot grow without bound. */
function pruneIps(now) {
  const cutoff = now - 3600_000;
  for (const [ip, times] of recentByIp) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length) recentByIp.set(ip, kept);
    else recentByIp.delete(ip);
  }
}

/**
 * Should we send a welcome text for this signup?
 *
 * Never throws and never blocks the signup itself. If the check cannot run —
 * database unreachable, bad response — it ALLOWS the send, because refusing
 * every legitimate member during a Supabase blip is a worse outcome than a
 * brief window with no ceiling.
 *
 * @returns {Promise<{allow:boolean, reason?:string, count?:number, scope?:string}>}
 */
export async function maySendWelcome(req) {
  const now = Date.now();

  // ── Layer 1: this IP, on this instance. ──
  try {
    pruneIps(now);
    const ip = clientIp(req);
    if (ip !== 'unknown') {
      const times = recentByIp.get(ip) || [];
      if (times.length >= PER_IP_PER_HOUR) {
        return { allow: false, scope: 'ip', count: times.length, reason: `${times.length} signups from one address (${ip}) in an hour` };
      }
      recentByIp.set(ip, times.concat(now));
    }
  } catch { /* never let the guard break the door */ }

  // ── Layer 2: everyone, everywhere. The wall. ──
  const url = SB_URL(), key = SB_KEY();
  if (!url || !key) return { allow: true };
  try {
    const since = new Date(now - 3600_000).toISOString();
    const r = await fetch(
      `${url}/rest/v1/member_channel?select=id&created_at=gte.${encodeURIComponent(since)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' } }
    );
    if (!r.ok) return { allow: true };                    // cannot tell: allow
    const cr = r.headers.get('content-range') || '';      // "0-0/123"
    const count = Number(cr.split('/')[1] || 0);
    if (count > GLOBAL_PER_HOUR) {
      return { allow: false, scope: 'global', count, reason: `${count} signups in the last hour, ceiling is ${GLOBAL_PER_HOUR}` };
    }
    return { allow: true, count };
  } catch {
    return { allow: true };                                // cannot tell: allow
  }
}
