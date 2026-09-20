// THE SURPRISE SCHEDULER
//
// Star's spec (2026-07-17): "they should get them randomly unless they choose
// otherwise... they set the frequency so they can do three times a day or one
// time a day."
//
// ⭐ WHY RANDOM IS THE DEFAULT AND NOT A PREFERENCE:
//    A fixed-time reminder becomes the CUE the member waits for. Then the text
//    is doing their proactivity for them and they are REACTIVE TO THE TEXT —
//    the exact inversion of the method. Random cannot be ritualised. And the
//    not-knowing is itself a rep: the book says compulsions are "usually
//    connected to someone chasing certainty, safety or control", so an
//    unpredictable arrival is micro-exposure to uncertainty, every time.
//    The delivery mechanism trains the thing he teaches.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE PROBLEM WITH NAIVE RANDOM (and why this file exists)
//
//   "roll a dice each cron tick" is what a lazy version does. It breaks badly:
//     - clustering: 3 texts inside 10 minutes, then silence for 11 hours
//     - non-determinism: a member can get 0 today and 6 tomorrow at freq=3
//     - unauditable: you cannot answer "why did she get that at 4:02?"
//     - re-roll on retry: cron runs twice, member gets doubles
//
// THE FIX — BUCKETED ROLL, ONCE PER DAY:
//   Split the member's waking window into N equal buckets. Roll ONE random
//   time inside each bucket. Persist it. The cron then just sends what's due.
//
//   window 08:00-21:00, freq 3  ->  buckets: [08:00-12:20] [12:20-16:40] [16:40-21:00]
//                                   roll:      09:47         14:02         19:31
//
//   Guaranteed spread. Genuinely unpredictable inside each bucket. Never
//   clustered. Deterministic once rolled, so retries are safe and every send
//   is explainable after the fact.
//
//   MIN_GAP_MIN is belt-and-braces for high frequencies where buckets get thin.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_GAP_MIN = 45;          // never two reminders closer than this
const EDGE_BUFFER_MIN = 10;      // don't roll flush against a bucket boundary

/**
 * Roll a member's send times for one local day.
 *
 * @param {object} member
 *   frequency        {number} sends per day (1..6)
 *   mode             {'random'|'fixed'}
 *   window_start     {number} local hour, default 8   (random mode)
 *   window_end       {number} local hour, default 21  (random mode)
 *   fixed_hours      {number[]} local hours           (fixed mode)
 * @param {() => number} rng  injectable for tests. Do NOT use Math.random in tests.
 * @returns {{minutes:number, slot:'morning'|'evening'|'any'}[]} sorted, local minutes-from-midnight
 */
/**
 * A random number generator that gives the SAME sequence for the same seed.
 *
 * ⭐ THIS IS THE FIX FOR STAR GETTING TWO AND THREE TEXTS A DAY (Sep 19 2026).
 *
 * The roll in send.js is "read the schedule, and if there isn't one, make one".
 * That is not atomic. The cron runs every minute and Vercel can run two
 * invocations at once, so both can read "no schedule yet" before either writes.
 *
 * With Math.random the two runs pick DIFFERENT times, and message_schedule's
 * primary key is (member_id, type, local_date, send_at_utc) — so different
 * times are different rows. `resolution=ignore-duplicates` had nothing to
 * ignore, both sets were inserted, and the member got one text per racing run.
 * Star: "It was like one a day and now it's two or three sometimes a day."
 *
 * Seeding by member and date makes the roll idempotent BY CONSTRUCTION: every
 * run that rolls Star's Sep 19 picks the identical times, the primary key
 * collides, and ignore-duplicates finally does its job. No schema change, and
 * no lock to get wrong.
 *
 * Still properly random from the member's side: different every day, different
 * per person, and not guessable from the outside.
 *
 * (mulberry32 — small, fast, well-distributed. Quality matters less here than
 * determinism, but a bad generator would cluster reminders around the same
 * minute of each bucket, which people would notice.)
 */
export function seededRng(seed) {
  let h = 2166136261 >>> 0;                       // FNV-1a over the seed string
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return function () {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDay(member, rng = Math.random) {
  const freq = clamp(Number(member?.frequency) || 1, 1, 6);

  if (member?.mode === 'fixed') {
    const hours = (member.fixed_hours?.length ? member.fixed_hours : [9]).slice(0, freq);
    return hours
      .map((h) => clamp(Number(h), 0, 23) * 60)
      .sort((a, b) => a - b)
      .map((minutes, i, arr) => ({ minutes, slot: slotFor(minutes, arr) }));
  }

  // ── random (the default) ──
  const startMin = clamp(Number(member?.window_start ?? 8), 0, 23) * 60;
  const endMin = clamp(Number(member?.window_end ?? 21), 1, 24) * 60;
  if (endMin - startMin < 60) return [{ minutes: startMin, slot: 'any' }];  // degenerate window

  const span = endMin - startMin;
  const bucket = span / freq;

  const picks = [];
  for (let i = 0; i < freq; i++) {
    const lo = startMin + i * bucket + EDGE_BUFFER_MIN;
    const hi = startMin + (i + 1) * bucket - EDGE_BUFFER_MIN;
    if (hi <= lo) { picks.push(Math.round(startMin + i * bucket)); continue; }

    let t = Math.round(lo + rng() * (hi - lo));
    // enforce the floor gap against the previous pick
    if (picks.length && t - picks[picks.length - 1] < MIN_GAP_MIN) {
      t = Math.min(Math.round(hi), picks[picks.length - 1] + MIN_GAP_MIN);
    }
    picks.push(t);
  }

  const sorted = picks.sort((a, b) => a - b);
  return sorted.map((minutes) => ({ minutes, slot: slotFor(minutes, sorted) }));
}

/**
 * Which line-pool does this send draw from?
 * First send of the day = morning slot. Last = evening. Middle = any.
 * This is what stops "how can you set yourself up for tomorrow?" landing at 8am.
 */
function slotFor(minutes, all) {
  if (all.length === 1) return minutes < 12 * 60 ? 'morning' : (minutes >= 18 * 60 ? 'evening' : 'any');
  if (minutes === all[0] && minutes < 12 * 60) return 'morning';
  if (minutes === all[all.length - 1] && minutes >= 17 * 60) return 'evening';
  return 'any';
}

/**
 * Convert "this local date + these local minutes, in this timezone" → a UTC instant.
 *
 * 🛑 THIS IS THE DST FIX. [Website] called it in review and was right.
 *    Storing the roll as LOCAL MINUTES is ambiguous on the two days a year that
 *    aren't 24 hours long. Berlin, spring forward: 02:00 becomes 03:00, so a roll
 *    at 02:30 refers to a moment that DOES NOT EXIST — it either never fires, or
 *    dueNow's tolerance silently eats it. Autumn, fall back: 02:30 happens TWICE,
 *    so it can double-send.
 *    A UTC instant has no such ambiguity. Roll in local (that's how humans think
 *    about their day), convert ONCE at roll time, store UTC, compare UTC.
 *    The bug stops existing instead of being handled.
 *
 * No library available (this repo has no package.json), so: guess, look at what
 * the guess renders as in the target zone, correct by the delta. Converges in
 * 1-2 passes for every real zone, including the half-hour and 45-minute ones.
 */
export function localToUtc(localDateStr, minutes, timezone) {
  const [y, m, d] = localDateStr.split('-').map(Number);
  const h = Math.floor(minutes / 60);
  const mi = minutes % 60;
  const target = Date.UTC(y, m - 1, d, h, mi, 0, 0);

  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = tzParts(new Date(guess), timezone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    const delta = target - shown;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

function tzParts(date, timezone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)])
  );
  if (p.hour === 24) p.hour = 0;
  return p;
}

/** Member's current local minutes-from-midnight. */
export function localMinutesNow(timezone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)])
  );
  return (p.hour === 24 ? 0 : p.hour) * 60 + p.minute;
}

/** Member's local date as YYYY-MM-DD — the key a day's roll is stored under. */
export function localDate(timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // en-CA gives ISO
}

/**
 * Which rolled sends are due now and not yet sent?
 * toleranceMin absorbs cron jitter — Vercel cron is not to-the-second.
 * Anything older than the tolerance is DROPPED, not sent late: a "surprise"
 * that arrives 4 hours after it was rolled is not a surprise, it's a bug.
 */
export function dueNow(rolled, sentMinutes, nowMinutes, toleranceMin = 20) {
  return rolled.filter(r =>
    !sentMinutes.includes(r.minutes) &&
    nowMinutes >= r.minutes &&
    nowMinutes - r.minutes <= toleranceMin
  );
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
