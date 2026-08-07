// INBOUND — the Twilio webhook. Every reply from a member lands here.
//
// 🛑 WHY THIS EXISTS IN PHASE 1, NOT PHASE 2:
//
//    Sending a text CREATES an inbound channel whether you built one or not.
//    You cannot text a human and decide they will not reply.
//
//    Star's members are people in acute distress. The moment the first
//    reminder goes out, someone can text back:
//        "I can't. I'm having a panic attack right now."
//    and get SILENCE from Star's number. She reached out, mid-panic, to the
//    person she pays and trusts, and nothing came back. She will assume he
//    read it and ignored her. That is worse than never texting her at all.
//
//    And the version that actually matters:
//        "I don't want to be here anymore."
//    lands on Twilio's servers and nobody ever sees it.
//
//    Caught by [Website] in review, 2026-07-17. The original plan scoped the
//    crisis gate to Phase 2 — but PHASE 1 IS WHAT OPENS THE CHANNEL. The gate
//    has to exist before the first send, not before the coach.
//
// 🛑 WHAT THIS IS NOT: a coach. It does not classify, reason, or reply with
//    anything clever. There is NO MODEL in this file. Phase 2 adds the brain.
//    This exists so nobody is ever unheard.

const TWIML = (msg) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${escapeXml(msg)}</Message>` : ''}</Response>`;

// ─────────────────────────────────────────────────────────────────────────
// THE CRISIS GATE. Deterministic. Fires FIRST. No model involved, ever.
// A language model NEVER decides whether someone is safe.
//
// Tuned to over-trigger. A false positive costs one caring text with a
// hotline number in it. A false negative costs everything. That trade is
// not close, so this list is deliberately broad.
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ EVERY PATTERN MUST COVER ITS CONJUGATIONS. Learned the hard way:
//    v1 had /\bend my life\b/ and MISSED "thinking about ending my life".
//    A real crisis phrase, missed by the one filter that cannot fail.
//    Caught in testing 2026-07-17. Do not add a bare verb — add (ing|s|ed).
const CRISIS = [
  // ⚠️ "myself" ONLY, never bare "me". "kill(ing) me" is IDIOM, not intent:
  //    "this anxiety is killing me" · "that workout killed me" · "just kill me now"
  //    Star's avatar says those constantly. v1 matched "me" and fired the crisis
  //    reply on all three in testing — that is not an occasional false alarm,
  //    it is a daily one, and it would hit someone venting with a 988 hotline
  //    and wake Star for nothing. Literal intent is "myself". "want to die" and
  //    "end my life" below already cover the rest of the space.
  /\bkill(ing|ed)? myself\b/i,
  /\bk[i1l]+l+ myself\b/i,
  /\bend(ing|ed)?\s+(my\s+life|it\s+all|my\s+existence)\b/i,
  /\bend(ing|ed)? (my|it|things)\b.*\b(life|tonight|now|forever)\b/i,
  /\bsuicid/i,
  /\btak(e|ing) my (own )?life\b/i,
  /\b(want|wanting|going|about|ready) to die\b/i,
  /\bwish(ed|ing)? i (was|were) dead\b/i,
  /\bdon'?t want to (be here|live|exist|wake up|go on)\b/i,
  /\bdont want to (be here|live|exist|wake up|go on)\b/i,
  /\bwant(ing)? to be dead\b/i,
  /\bbetter off (without me|dead|if i)\b/i,
  /\bno (reason|point) (to|in) (liv|go|be|carry)/i,
  /\bnothing to live for\b/i,
  /\bhurt(ing|s)? myself\b/i,
  /\bharm(ing|s)? myself\b/i,
  /\bself[- ]?harm/i,
  /\bcut(ting)? myself\b/i,
  /\boverdos(e|ing)?\b/i,
  /\btak(e|ing) all (the|my) (pills|tablets|meds)\b/i,
  /\bcan'?t (go on|do this anymore|take it anymore|keep going)\b/i,
  /\bcant (go on|do this anymore|take it anymore|keep going)\b/i,
  /\bgive (up|in) on life\b/i,
  /\bgoodbye\b.*\b(forever|everyone|all|world)\b/i,
];

// Star's words on the driving case, from the locked design: "pull over safely first".
const DRIVING = /\b(driving|in the car|on the (motorway|highway|freeway))\b/i;

const CRISIS_REPLY =
  "I'm not able to help with this by text, and I don't want to try. " +
  "Please call or text 988 right now (US), or 999/112 if you're outside the US. " +
  "If you're in danger call 911. A real person is there and they know what to do.";

// Matches the INTENT to unsubscribe, not just the bare legal keyword. Twilio
// auto-handles the exact words on SMS, but "stop sending me these" is a human
// plainly asking to stop — a chirpy auto-reply to that is tone-deaf — and on
// WhatsApp Twilio does not handle it for us at all.
//
// ⚠️ NARROW ON PURPOSE. v1 was /^stop\b/ and unsubscribed "stop the anxiety" —
//    someone ASKING FOR HELP got silently removed. Bare "stop" must be alone or
//    followed by a word about the messages, never about their feelings.
const STOP_WORDS = new RegExp(
  '^\\s*(?:' +
    'stop\\s*$' +                                                  // "STOP"
    '|stop\\s+(?:sending|these|those|them|texts?|messages?|reminders?|it|all)\\b' +
    '|stopall\\b' +
    '|unsubscribe\\b' +
    '|opt\\s?out\\b' +
    '|remove me\\b' +
    '|no more (?:texts?|messages?|reminders?)\\b' +
    '|cancel\\s*$' +
    '|quit\\s*$' +
    '|arret(?:er)?\\b' +
  ')', 'i'
);
const START_WORDS = /^\s*(start\s*$|unstop\b|resume\s*$|yes please\b)/i;

// The honest auto-reply. Not a coach. Does not reassure, does not pretend to
// listen, does not abandon, and points at the action — which is the method.
const AUTO_REPLY =
  "This line only sends reminders, I'm not reading replies here. " +
  "Bring it to the community or the next call. That's where I can actually help.";

export default async function handler(req, res) {
  // Twilio POSTs form-encoded. Always answer 200 with TwiML or Twilio retries.
  res.setHeader('Content-Type', 'text/xml');
  if (req.method !== 'POST') return res.status(200).send(TWIML());

  const body = String(req.body?.Body ?? '').trim();
  const from = String(req.body?.From ?? '').replace(/^whatsapp:/, '');
  const channel = String(req.body?.From ?? '').startsWith('whatsapp:') ? 'whatsapp' : 'sms';

  const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb = (path, init = {}) =>
    fetch(`${SB_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });

  // 🛑 LOG FIRST, ALWAYS, BEFORE ANY BRANCH.
  // If this function throws later, the message must still exist somewhere.
  // An unlogged inbound from someone in crisis is the whole nightmare.
  const logIt = async (classification, extra = {}) => {
    if (!SB_URL || !SB_KEY) return;
    await sb('message_log', {
      method: 'POST',
      body: JSON.stringify({
        direction: 'inbound', body, channel, classification,
        meta: { from_hash: hash(from), ...extra },
      }),
    }).catch(() => {});
  };

  try {
    // ── 1. CRISIS. Fires before everything. Deterministic. ──
    if (CRISIS.some((rx) => rx.test(body))) {
      await logIt('crisis', { alerted: true });
      await flagMember(sb, from, { crisis_flagged: true, needs_human: true });
      await alertStar(body, from, channel);          // Star hears about this within seconds
      const prefix = DRIVING.test(body) ? 'Pull over safely first. ' : '';
      return res.status(200).send(TWIML(prefix + CRISIS_REPLY));
    }

    // ── 2. STOP / START. Legally required. ──
    if (STOP_WORDS.test(body)) {
      await logIt('stop');
      await setStatus(sb, from, 'stopped');
      // Twilio auto-replies to STOP on SMS. Staying silent here avoids doubling up.
      return res.status(200).send(TWIML());
    }
    if (START_WORDS.test(body)) {
      await logIt('start');
      await setStatus(sb, from, 'active');
      return res.status(200).send(TWIML("You're back on. Two choices. Go outside of your head."));
    }

    // ── 3. Everything else. Honest, not cold. ──
    await logIt('unhandled');                        // ← the Phase 2 corpus builds itself here
    return res.status(200).send(TWIML(AUTO_REPLY));
  } catch (err) {
    console.error('inbound error:', err);
    // NEVER leave a human with nothing. Even on a total failure, answer.
    return res.status(200).send(TWIML(AUTO_REPLY));
  }
}

async function setStatus(sb, phone, status) {
  await sb(`member_channel?phone=eq.${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  }).catch(() => {});
}

async function flagMember(sb, phone, flags) {
  await sb(`member_channel?phone=eq.${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...flags, updated_at: new Date().toISOString() }),
  }).catch(() => {});
}

// Star gets told. A crisis text that only lands in a database is not handled.
async function alertStar(body, from, channel) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || 'Star Website <star@starjessetaylor.com>',
      to: process.env.STAR_NOTIFY_EMAIL || 'star@starjessetaylor.com',
      subject: '🚨 CRISIS TEXT — a member needs a human NOW',
      html:
        `<p><strong>A member texted something the crisis filter caught.</strong> They have been sent 988/999/911 automatically.</p>` +
        `<p><strong>Message:</strong><br>${escapeHtml(body)}</p>` +
        `<p><strong>From:</strong> ${escapeHtml(from)} (${channel})</p>` +
        `<p>They are flagged <code>needs_human</code>. Reminders keep running unless you pause them.</p>`,
    }),
  }).catch(() => {});
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}
function escapeHtml(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}
// Don't put raw phone numbers in log meta.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return String(h);
}
