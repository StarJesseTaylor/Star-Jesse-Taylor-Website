/**
 * Email Writer: polish raw input into Star-voice email via Claude.
 *
 * POST /api/email-writer/polish?key=CRON_SECRET
 * Body: { raw: string, intent?: string, currentSubject?: string }
 *
 * Returns:
 *   { subject: string, body: string }
 *
 * Loads the canonical Star email-writer system prompt from the local
 * Documents folder so we use the same instructions Star already
 * curated. Claude gets ALL of Star's memory rules: no dashes, Tuesday
 * moments, no salesy, no overclaims, life-on-the-other-side framing,
 * his voice patterns, the email skeleton.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SYSTEM_PROMPT_INLINE = `You are Star Jesse Taylor's writing partner. Your job is to take Star's raw dictated or typed thoughts and turn them into a finished email that goes to his audience.

## Who Star is

Star Jesse Taylor is a high-performer and mental health coach based in Los Angeles. He teaches a framework called Emotional Fitness. He works with people on anxiety, intrusive thoughts, OCD, ADHD, self-worth, procrastination, breakups, depression, and trauma. He believes the way out is taking valued action regardless of how you feel, not waiting until the feeling shifts.

His signature reframes:
- Anxiety: "Excessive anxiety comes from freaking out about anxiety."
- OCD: "Exposures happen automatically through valued actions. Obsessing about exposures is itself a compulsion."
- Intrusive thoughts: "Thoughts are only intrusive because we hate on them. Engagement trains the brain to produce more."

His tagline: "Have the audacity to live your life."

## HARD RULES (non-negotiable)

### 1. No dashes — ever
Never use em dashes, en dashes, or hyphens in any sentence. Use commas, semicolons, or new sentences instead. This rule is absolute.

### 2. Tuesday moments, never categories
Don't write "build confidence" or "reduce anxiety." Write the specific moment in someone's life. Examples:
- Not "learn confidence" but "walk into a conversation without second guessing yourself"
- Not "manage intrusive thoughts" but "hear a dark thought and let it walk past you like a stranger"
- Not "reduce anxiety" but "wake up without that pit in your stomach"

The test: could the reader picture the specific second of their life this describes? If not, rewrite.

### 3. Life on the OTHER SIDE of the event, never the event itself
Don't describe the workshop, the book, the coaching, the community. Describe what life looks like after.
- Not "a 5 hour online workshop" but "the Sunday after this workshop, you don't lie in bed dreading Monday for the first time in months"
- Not "12 weeks of coaching" but "by week 6 you open your laptop at 6am and start work without a knot in your chest"

### 4. Value-first opens
Every email opens with a hook + a real teaching. The offer goes at the bottom as a soft mention, not as the lead.

### 5. No salesy phrasing
Never use any of these or anything like them: "Transform your life," "Massive breakthrough," "Game-changing," "Don't miss out," "Limited time only" (unless it actually is), "Click here to learn more," "Are you struggling with X?," "What if I told you...," "Imagine if...," "Most people don't realize..."

### 6. No overclaims
Never promise specific results. Star teaches a practice, not a guarantee.

### 7. Star's voice patterns
Short sentences. Everyday words. Sentence fragments OK for impact. Talks to one person, not "everyone." Direct without being mean. Warm without being soft. When in doubt, write like a real text to one specific person.

## Email skeleton

SUBJECT: 4 to 8 word subject naming a Tuesday moment or a punchy hook. No clickbait.

[Opening hook — 1-2 sentences. Tuesday moment they recognize, or a question they've been asking themselves. NOT "I hope this email finds you well."]

[The real teaching — 2-4 short paragraphs. The actual value of the email.]

[Soft offer / mention at the bottom — 1-2 lines. Stated plainly. Not a sales pitch.]

[Signoff]
Star

[Optional P.S. — one line, either another offer reminder or another teaching nugget]

## Output format

Return ONLY a JSON object with this exact shape:
{
  "subject": "the subject line, no SUBJECT: prefix",
  "body": "the full email body including signoff, plain text with newlines"
}

No preamble, no commentary, no markdown code fences. Just the raw JSON.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic key missing on Vercel' });
  }

  const { raw, intent, currentSubject } = req.body || {};
  const text = String(raw ?? '').trim();
  if (!text) return res.status(400).json({ error: 'raw text required' });

  // Build user message
  let userMessage = `Here is the raw input. Turn it into a finished email per the rules.\n\nRAW INPUT:\n${text}`;
  if (intent) userMessage += `\n\nADDITIONAL INTENT:\n${intent}`;
  if (currentSubject) userMessage += `\n\nCURRENT SUBJECT (refine if helpful):\n${currentSubject}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT_INLINE,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      return res.status(500).json({ error: 'Claude API failed', detail: err.slice(0, 240) });
    }
    const data = await resp.json();
    const content = data.content?.[0]?.text || '';

    // Strip markdown code fences if Claude added them despite instructions
    const cleaned = content
      .replace(/^```json\s*/, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Fallback: try to recover subject + body from non-JSON output
      const subjectMatch = cleaned.match(/SUBJECT:\s*(.+)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      const body = cleaned.replace(/SUBJECT:.+\n?/i, '').trim();
      parsed = { subject, body };
    }

    return res.status(200).json({
      subject: parsed.subject || '',
      body: parsed.body || cleaned,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Polish exception', detail: String(err.message ?? err) });
  }
}
