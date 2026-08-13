// ⭐ STAR'S 30 REMINDERS. HIS WORDS. DICTATED 2026-07-17.
//
// 🛑 THIS FILE IS THE PRODUCT. Read this before touching anything in it.
//
//   These are NOT examples for an AI to imitate. There is NO generation here.
//   The member receives one of these lines, with blanks filled in. That is the
//   whole feature.
//
//   Why it is built this way: nothing freestyles, so nothing can drift, nothing
//   can hallucinate at 2am, and nothing can reassure. It is literally Star
//   talking. Every one of these passed the audit guard on the first run.
//
// 🛑 DO NOT:
//   - edit the text. Not the grammar, not "wanna", not the exclamation marks.
//   - add a line Claude wrote. Star reviewed 18 Claude-proposed candidates from
//     his own book and workshop and rejected ALL of them: "I only like the list
//     of mine, not the extra ones that you gave me." An empty slot beats a fake
//     Star line.
//   - "improve" a line for length. Ask him.
//
// Source of truth for the human-readable list + Star's notes:
//   Documents\Star_Content_Strategy\STAR_REMINDER_LINES_verbatim.txt
//
// SLOTS (filled from the member's profile, not invented):
//   {tomorrow_man}  -> "tomorrow you"  (Star's call Aug 13 2026 — was man/woman.
//                      Token name kept so the 30 lines stay byte-identical.)
//   {action}        -> their valued action, from opt-in
//   {seconds}       -> COMPUTED at send: seconds until midnight in their timezone
//
// WHEN: 'any' | 'morning' | 'evening'
//   Some lines are nonsense at the wrong hour. #17 is an evening line.
//   The picker must respect this, including in random mode.

export const LINES = [
  { id: 1,  when: 'any',     text: "Remember, you only have two choices. You can be inside of your head or outside of your head. Now go outside of your head!" },
  { id: 2,  when: 'any',     text: "Are you inside of your head? It's time to get outside of your head now!" },
  { id: 3,  when: 'any',     text: "What do you want to spend your time on?" },
  { id: 4,  when: 'any',     text: "What is the most impactful action to support you right now?" },
  { id: 5,  when: 'any',     text: "Remember your {tomorrow_man}! What actions will support {tomorrow_pronoun}?" },
  { id: 6,  when: 'any',     text: "Move forward with the wrong feeling." },
  { id: 7,  when: 'any',     text: "Stop trying to do it perfectly! Make it messy." },
  { id: 8,  when: 'any',     text: "Stop trying to get results! Make it about exploring." },
  { id: 9,  when: 'any',     text: "Follow your excitement with no insistence on the outcome." },
  { id: 10, when: 'any',     text: "Your day is not bad because of uncomfortable feelings. Your day is good when you support yourself with valued actions." },
  { id: 11, when: 'any',     text: "Minimize your freak-outs and maximize your successes!" },
  { id: 12, when: 'any',     text: "Short-term relief gives you long-term pain." },
  { id: 13, when: 'any',     text: "No brain. We're doing this right now." },
  { id: 14, when: 'any',     text: "What are you excited about?" },
  { id: 15, when: 'any',     text: "Do you wanna spend your time inside of your head or outside of your head?" },
  { id: 16, when: 'any',     text: "How can you support your {tomorrow_man}?" },
  { id: 17, when: 'evening', text: "How can you set yourself up for success for tomorrow?" },
  { id: 18, when: 'any',     text: "To find your balance, you need to keep moving forward." },
  { id: 19, when: 'any',     text: "Get off your phone and do the valued actions!" },
  { id: 20, when: 'any',     text: "You have {seconds} seconds left in the day. How many of those do you want to spend inside of your head?" },
  { id: 21, when: 'any',     text: "You can't control the thoughts that come inside of your head, but you can control if you're talking back to them." },
  { id: 22, when: 'any',     text: "I love meditating wrong, brain!" },
  { id: 23, when: 'any',     text: "I love doing it wrong, brain!" },
  { id: 24, when: 'any',     text: "Make it a badge of honor that you can have any feelings and do your valued actions." },
  { id: 25, when: 'any',     text: "What are you giving your attention to?" },
  { id: 26, when: 'any',     text: "Confidence comes after the action." },
  { id: 27, when: 'any',     text: "What are you showing your brain that you care about right now?" },
  { id: 28, when: 'any',     text: "Are you standing outside the playing field of life, trying to be perfect, or are you playing and throwing yourself in the mud? Splashing in the rain, when there's rain on the ground." },
  { id: 29, when: 'any',     text: "If you don't set intentions for your life, other people will set them for you." },
  { id: 30, when: 'morning', text: "If you don't set intentions for your day, your brain will set them for you." },
];

// Lines with an {action} variant. Star's book names the action in the No Brain
// method ("No Brain, we are walking right now"), so #13 gets one when we know it.
const ACTION_VARIANTS = {
  13: "No brain. We're {action} right now.",
};

// 🛑 THE GRAMMAR TRAP — caught in testing 2026-07-17, would have shipped broken.
//
//   #13's slot only works if the action is a GERUND. Star's book: "No Brain, we
//   are WALKING right now" / "we are WORKING OUT right now".
//   But a member asked "what's the one valued action you're working on?" types
//   "call my sister" — and the line renders:
//       "No brain. We're call my sister right now."   ← broken English, to a
//   paying member, in Star's name.
//
//   We do NOT try to conjugate it. Auto-gerunding English is a swamp
//   ("go to the gym" -> "going to the gym" ✓, but "call my sister" -> "calling
//   my sister" ✓, "do my taxes" -> "doing my taxes" ✓, "run" -> "running" ✓,
//   "be present with my kids" -> "being present..." ✓, yet "gym" -> "gyming" ✗)
//   and a wrong guess is worse than no personalisation.
//
//   RULE: only use the action variant when the action ALREADY reads as a
//   gerund. Otherwise send Star's generic line, which is always correct.
//   The real fix is at the opt-in: ask for it in gerund form. See below.
const GERUND = /^(?:[a-z]+ing)\b/i;

/** Is this action safe to drop into "We're ___ right now"? */
export function actionFitsNoBrain(action) {
  return typeof action === 'string' && GERUND.test(action.trim());
}

/** Seconds from now until midnight in the member's timezone. */
export function secondsLeftToday(timezone) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const h = parts.hour === 24 ? 0 : parts.hour;
  return 86400 - (h * 3600 + parts.minute * 60 + parts.second);
}

/**
 * Fill a line's slots from the member. Never invents — if a slot has no value,
 * that line is not eligible (see pickLine).
 */
export function render(line, member) {
  let text = line.text;

  // Only personalise #13 if the action is gerund-shaped. See THE GRAMMAR TRAP.
  if (ACTION_VARIANTS[line.id] && actionFitsNoBrain(member?.valued_action)) {
    text = ACTION_VARIANTS[line.id];
  }

  // ⭐ "TOMORROW YOU" — Star's call, Aug 13 2026. Replaces tomorrow man/woman.
  //    This deliberately IGNORES member_channel.tomorrow_word. The column and its
  //    CHECK constraint stay in the DB (dropping it needs a migration and buys
  //    nothing), but nothing reads it any more. Consequence: we no longer have to
  //    know a member's gender before we can send #5 or #16 — two of Star's five
  //    priority lines — so those lines are now sendable to everyone from message one.
  const secs = member?.timezone ? secondsLeftToday(member.timezone).toLocaleString('en-US') : '';

  return text
    .replace(/\{tomorrow_man\}/g, 'tomorrow you')
    // "them", not "you" — the whole point of the teaching is that tomorrow you is
    // a separate person you're doing something FOR. "support you" collapses that
    // distance and the line stops teaching anything.
    .replace(/\{tomorrow_pronoun\}/g, 'them')
    .replace(/\{action\}/g, (member?.valued_action || '').trim())
    .replace(/\{seconds\}/g, secs);
}

/** Is this line sendable to this member at this slot? */
function eligible(line, member, slot) {
  if (line.when !== 'any' && line.when !== slot) return false;
  // #20 needs a timezone to compute the countdown. No timezone, no line.
  if (line.id === 20 && !member?.timezone) return false;
  return true;
}

// ⭐ STAR'S PRIORITY LINES — set by Star, Aug 7 2026.
//
//   Asked which reminders matter most, he named exactly two ideas:
//     "Some of them are spent time outside of your head."  -> #1, #2, #15
//     "Think of your tomorrow man."                        -> #5, #16
//
//   Those are the two that carry the method. Everything else is 1.
//   This is a WEIGHT, not a filter: every line still ships, the named ones
//   just come round more often. Set a weight to 1 to demote, 3 to promote.
//
//   Candidates Star can promote (annotated as tomorrow-man lines in
//   STAR_REMINDER_LINES_verbatim.txt, but he didn't name them out loud):
//     #12 "Short-term relief gives you long-term pain."  (the mechanic in 6 words)
//     #17 "How can you set yourself up for success for tomorrow?" (evening)
const WEIGHT = { 1: 3, 2: 3, 15: 3, 5: 3, 16: 3 };
const weightOf = (line) => WEIGHT[line.id] || 1;

/**
 * Pick the next line. Avoids the member's recent history so the rotation feels
 * fresh — with 30 lines, 1x/day repeats after a month, 3x/day after ~10 days.
 * Star's priority lines are weighted up (see WEIGHT above).
 *
 * @param {object} member
 * @param {number[]} recentIds  line ids already sent recently (most recent first)
 * @param {'morning'|'evening'|'any'} slot
 */
export function pickLine(member, recentIds = [], slot = 'any') {
  const pool = LINES.filter(l => eligible(l, member, slot));
  if (!pool.length) return null;

  const unseen = pool.filter(l => !recentIds.includes(l.id));
  const from = unseen.length ? unseen : pool;   // everything seen? start the cycle again

  // Weighted pick. Still never repeats until the pool is exhausted — the weight
  // changes the ORDER lines come round in, not whether they come round at all.
  const total = from.reduce((s, l) => s + weightOf(l), 0);
  let r = Math.random() * total;
  for (const l of from) {
    r -= weightOf(l);
    if (r < 0) return l;
  }
  return from[from.length - 1];   // float guard
}
