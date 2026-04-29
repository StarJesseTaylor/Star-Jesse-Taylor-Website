// Blue · Midday Check-in
// Scheduled by Vercel cron at 19:00 UTC weekdays (12 PM PT during PDT, 11 AM PT during PST)
// Sends Star a short check-in email asking ONE good question.
// His reply (via email or chat) becomes training data for `about_star.md`.

import {
  BLUE_CONFIG,
  callBlue,
  sendBlueEmail,
  isAuthorizedCron,
  daysUntilEvent
} from './_lib.js';

export default async function handler(req, res) {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Skip on weekends (run Mon thru Fri only)
    const dayOfWeek = new Date().getUTCDay(); // 0 Sun ... 6 Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({ status: 'weekend, no check-in' });
    }

    const days = daysUntilEvent();
    const today = new Date().toISOString().split('T')[0];

    // Build check-in prompt for Blue
    const userPrompt = `It is the middle of the day on ${today}. ${days} days until the May 30 LA event.

Write Star his daily midday check-in email.

This email is short. 4 to 6 sentences total. Tone is warm, mentor presence, not transactional. The day is in motion. Star has been working since this morning. Your job is to be a steady presence and ask him to pause for one breath.

Structure:
1. Open with one specific noticing or care line (e.g., "Hope the morning treated you well" or "Halfway through the day, checking in").
2. Ask ONE good question. Not three. Not a list. ONE. Vary the question day to day. Examples to draw from (do not use the same one twice in a row):
   - "How is the day actually going so far? Honest."
   - "What did you do this morning that mattered? What did you do that didn't?"
   - "Where is your energy right now? Pulled or focused?"
   - "What is one thing you can let go of for the rest of the day?"
   - "Have you eaten? Have you moved your body? Have you stepped outside?"
   - "What is the one promise to yourself you can keep this afternoon?"
   - "If today were a 4-hour day instead of 8, what would actually move the needle?"
   - "Are you running any of your own compulsions right now? You teach this. I'm asking."
   - "Name one thing from this morning you are quietly proud of."
   - "Who in your life have you not spoken to in a while who matters?"
   - "What is the body asking for that you have been ignoring?"
   - "If the second half of the day went exactly the way you wanted, what would happen?"
3. Tell him: "Reply when you have a minute. I'll read it before our next conversation."
4. Sign Blue.

Do not include subject line. Do not use markdown headers. Plain prose. No dashes ever.`;

    const blueText = await callBlue(userPrompt, 600);

    const subject = `Blue · Midday · ${formatDate(today)}`;
    await sendBlueEmail(subject, blueText);

    return res.status(200).json({ status: 'sent', type: 'midday_checkin' });

  } catch (err) {
    console.error('[Blue midday-checkin] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}
