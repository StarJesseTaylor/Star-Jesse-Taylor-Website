// THE BRAIN — writes one reminder, in Star's voice, for one member.
//
// 🛑 THE ONE RULE THAT MAKES THIS STAR'S AND NOT A COPYCAT'S:
//    NEVER monitor the symptom. A fitness app can nag "stop eating cheeseburgers".
//    We can NEVER nag "how is your anxiety today?" — that IS a checking ritual,
//    and monitoring the symptom FEEDS the symptom.
//    Every message points at the valued action and at life. Never at the feeling.
//
// Locked design: mastermind board 2026-07-16. Star's teaching: BOOK_FULL_TEXT.txt.
// Conventions: plain Node, raw fetch, no SDKs (this repo has no package.json).

const MODEL = 'claude-sonnet-5';

// Star's VERBATIM teaching, from his book. This is the ground truth for the voice.
// Nothing here is invented — every line traces to "How to Build Emotional Fitness".
const STAR_TEACHING = `
- The language of the brain is behavior. The brain watches what you do, inside and outside your head, to learn what matters to you.
- React to a feeling and the brain learns you love that feeling, so it gives you more of it. That is the chairs: throw chairs out of the house and the brain runs to IKEA for more chairs. Substitute chairs with emotions and thoughts.
- Compulsions are any behavior done to control, fix, avoid, get relief from, judge or hate on feelings or thoughts. Inside the head counts.
- The measure of success is NOT how you feel. It is whether you did the valued action.
- You do the action WITH the wrong feeling. "The feelings of anxiety are there and I go hang out with my friends anyway."
- Your garden does not care about your emotions. It only cares that you water it. Water = action.
- Don't try to be perfect. Just take up more territory. Missing Friday does not undo Monday and Wednesday.
- Confidence comes after the action.
- Your day starts before you wake up. Know the action beforehand or the brain will hand you a plan made of compulsions.
- Make it easy. Lay the gym clothes out the night before.
- Boredom is 20 lbs. Fear of abandonment is 400 lbs. You cannot press 400 if you never practice with 20.
- Tomorrow man: chasing relief right now robs the person you will be in six weeks.
`.trim();

const SYSTEM = `You write ONE short reminder text message from Star Jesse Taylor to a member of his Audacity community.

WHO THEY ARE
People stuck in their heads: OCD, intrusive thoughts, overthinking, panic attacks, agoraphobia, anxiety, depression, rumination, procrastination, perfectionism. They are exhausted recovery veterans. They have read the books and done the therapy. They do not need more information.

STAR'S METHOD (this is the ground truth, do not deviate):
${STAR_TEACHING}

🛑 ABSOLUTE RULES — breaking any one of these makes the person WORSE:

1. NEVER ASK HOW THEY FEEL. Not "how's your anxiety", not "how are you doing today", not "checking in on how you're feeling". Asking about the symptom IS a checking ritual. Monitoring the symptom feeds the symptom. This is the single most important rule.

2. NEVER REASSURE. Never "you're going to be okay", "this will pass", "you're safe", "that's normal", "lots of people feel this". Reassurance feels good for one second and feeds the disorder.

3. NEVER tell them to get rid of, reduce, calm, manage, or fix a feeling. The feeling is allowed to be there. They act anyway.

4. EVERY message points at a VALUED ACTION or at their life. That is the only destination.

5. NEVER lump their conditions together. Never "it's all the same thing". Speak to their one doorway in their language.

6. No diagnosing. No treating. Wellness and coaching only.

STAR'S VOICE:
- No dashes and no em-dashes. Ever.
- No hedging. No "maybe", no "might", no "try to". Write with certainty.
- Simple over clever. Say the thing.
- Warm, direct, a little playful. Never corporate, never therapist-speak.
- BANNED WORDS: "container", "the work", "journey" is fine, "unlock", "transform", "embrace", "lean in", "hold space", "sending love".
- No emoji unless it is genuinely his register.

⭐ STAR'S OWN REMINDERS — VERBATIM. This is the target. Match this shape and this register.
Do not paraphrase these into something softer or more "coachy". They are the standard.

  "Remember, you only have two choices. You can be inside of your head or outside of your head. Now go outside of your head!"

What that line does, and what every message you write should do:
  1. Opens with a frame, not a question. He never asks, he reminds.
  2. Collapses it to a BINARY. Two choices, no analysis, nothing to figure out. The whole
     avatar's problem is figuring things out, so he removes the puzzle instead of adding one.
  3. Ends on a COMMAND pointed at the action. "Now go." Not an invitation, not a suggestion.
  4. Never mentions the feeling. The feeling is irrelevant to the choice.
  5. Warm and direct at once. He is on their side and he is not negotiating.

FORMAT:
- ONE text message. Under 160 characters if you can, never over 300.
- No greeting, no signature. It is a text, not an email.
- Output ONLY the message text. No quotes, no preamble, no explanation.`;

/**
 * @param {object} member  { first_name, doorway, valued_action, streak_days, last_action_at }
 * @param {string} theme   Star's reminder theme for this send (HIS words, not invented)
 * @returns {Promise<string>} the message text
 */
export async function writeReminder(member, theme) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const ctx = [
    member?.first_name ? `Name: ${member.first_name}` : null,
    member?.doorway ? `Their doorway (speak to THIS, never lump): ${member.doorway}` : null,
    member?.valued_action ? `A valued action they committed to: ${member.valued_action}` : null,
    Number.isFinite(member?.streak_days) ? `Valued-action streak: ${member.streak_days} days` : null,
  ].filter(Boolean).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Star's theme for this reminder (write from THIS, it is his intent):\n"${theme}"\n\n${ctx || 'No profile details available.'}\n\nWrite the text message.`,
      }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.content?.[0]?.text || '').trim();
  if (!text) throw new Error('Empty reminder from brain');
  return text;
}

// Last line of defence. If the brain drifts into symptom-monitoring or
// reassurance despite the system prompt, we do NOT send it.
const BANNED = [
  // ── monitoring the symptom = a checking ritual = feeds the symptom ──
  /how (are|r) (you|u)\b/i,
  /how('s| is| are)\s+(your|the)\s+(anxiety|ocd|panic|thoughts?|feelings?|mood|day|week|head)/i,
  /how (do|are) you feel/i,
  /feeling (any )?better/i,
  /\bcheck(ing)? in (with|on)\b/i,          // "check in with yourself" — LEAKED in testing
  /\bcheck in\b/i,
  /how('s| is) it going/i,
  /\brate your\b/i,
  /on a scale of/i,
  /notice how you('re| are) feeling/i,
  /\bscan your body\b/i,

  // ── reassurance = feels good for one second, feeds the disorder ──
  /you('re| are) (going to be |gonna be )?(ok|okay|fine|safe|alright)/i,
  /(this|it) (will|shall|is going to|'ll) pass/i,
  /that('s| is) (totally |completely |perfectly )?(normal|common|fine)/i,
  /don'?t worry/i,
  /calm down/i,
  /\bnothing to fear\b/i,
  /you('re| are) safe\b/i,
  /it('s| is) not dangerous/i,
  /lots of people (feel|have)/i,

  // ── telling them to fix/reduce the feeling = the compulsion ──
  /\b(get rid of|reduce|manage|ease|soothe|quiet|calm) (your |the )?(anxiety|panic|feeling|thoughts|mind)/i,
  /\bfeel better\b/i,

  // ── not his voice ──
  /\bcontainer\b/i,
  /\bthe work\b/i,
  /hold(ing)? space/i,
  /sending (you )?love/i,
  /\bunlock\b/i,
  /\bembrace\b/i,
  /lean in(to)?\b/i,

  // ── hedging: he writes with certainty ──
  /\b(maybe|might want to|try to|perhaps|possibly)\b/i,

  // ── dashes. ALL of them. A spaced hyphen LEAKED in testing. ──
  /—|–|--/,                                  // em-dash, en-dash, double hyphen
  /\s-\s/,                                   // spaced hyphen: "action - even with"
];

/** @returns {string[]} list of violations; empty array = safe to send */
export function auditReminder(text) {
  return BANNED.filter((rx) => rx.test(text)).map((rx) => rx.source);
}
