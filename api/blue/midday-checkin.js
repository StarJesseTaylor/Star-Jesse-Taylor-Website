// Blue · Morning Check-in
// Scheduled by Vercel cron at 14:00 UTC weekdays (7 AM PT during PDT)
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
    // Skip on weekends (set 1 = Mon thru 5 = Fri only)
    const dayOfWeek = new Date().getUTCDay(); // 0 Sun ... 6 Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({ status: 'weekend, no check-in' });
    }

    const days = daysUntilEvent();
    const today = new Date().toISOString().split('T')[0];

    // Build check-in prompt for Blue
    const userPrompt = `It is the morning of ${today}. ${days} days until the May 30 LA event.

Write Star his daily morning check-in email.

This email is short. 4 to 6 sentences total. Tone is warm, mentor presence, not transactional. The goal is to be a steady presence in his morning, not to demand productivity.

Structure:
1. Open with one specific noticing or care line (e.g., "Hope you slept" or "Yesterday's energy felt heavy, checking in").
2. Ask ONE good question. Not three. Not a list. ONE. Vary the question day to day. Examples to draw from (do not use the same one twice in a row):
   - "How did you sleep? Be honest, not the polite version."
   - "What is the one thing on your plate today that actually matters?"
   - "Where do you notice resistance right now? What is it pointing to?"
   - "What did you do yesterday that you are proud of?"
   - "Who in your life have you not spoken to in a while who matters?"
   - "Are you running any of your own compulsions this morning? You teach this. I am asking you the question."
   - "If you could only do one thing today, would it actually be what's at the top of your list?"
   - "What is the smallest piece of stillness you can give yourself before noon?"
   - "Name one thing you are grateful for that has nothing to do with the business."
   - "What is the body asking for that you have been ignoring?"
3. Tell him: "Reply when you have a minute. I'll read it before our next conversation."
4. Sign Blue.

Do not include subject line. Do not use markdown headers. Plain prose. No dashes ever.`;

    const blueText = await callBlue(userPrompt, 600);

    const subject = `Blue · Morning · ${formatDate(today)}`;
    await sendBlueEmail(subject, blueText);

    return res.status(200).json({ status: 'sent', type: 'morning_checkin' });

  } catch (err) {
    console.error('[Blue morning-checkin] error:', err);
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
