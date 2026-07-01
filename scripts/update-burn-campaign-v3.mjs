#!/usr/bin/env node
/**
 * Update burn campaign v3:
 * - New hero: star-hero.jpg (Star clearly visible, not group shot)
 * - Opening rewrite with "Why are they having an easier time flowing through life?" rhetorical
 * - Battleground inside the head emphasis + "they don't even know what the battleground is"
 * - "Brain gives you more of the battlefield" mechanism
 * - "Right when you wake up and at any random time during the day" concrete consequence
 * - REMOVED "you keep trying to heal your trauma"
 * - Stop-fighting section: "battlefield" not "battleground", cut "Step off it.", add "you need to" prefix
 * - "That's how you show your brain..." not "Show your brain..."
 */

import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const API_KEY = CONFIG.api_key;
const SERVER = CONFIG.server;
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';

const AUTH = `apikey:${API_KEY}`;
const AUTH_HEADER = `Basic ${Buffer.from(AUTH).toString('base64')}`;

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`MailChimp API error ${res.status}:`, text);
    throw new Error(`API call failed: ${path}`);
  }
  return text ? JSON.parse(text) : {};
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>You keep waiting to feel ready before you live</title>
</head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f6f4ef;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/star-hero.jpg?v=3" alt="Star Jesse Taylor" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:36px 32px 0 32px;">
<p style="margin:0 0 22px;font-size:18px;line-height:1.6;font-weight:600;color:#1c1c1c;">Are you tired of watching everyone else live their life while you fight what's in your head?</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You see everyone else moving forward. They're not avoiding their passion. They're not staying in the safe job. They're not playing small in the room.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">Why are they having an easier time flowing through life?</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The answer is they're not fighting so much. They're not fighting on the battleground inside of their head. They don't even know what the battleground is.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">They haven't taken their thoughts and emotions as seriously as you do.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Because you took them seriously, you engaged with them.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The problem is, <strong>the brain's language is engagement</strong>. Which means you showed the brain that you love to engage with the battlefield.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain gives you more of the battlefield.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>

<p style="margin:28px 0;font-size:22px;line-height:1.5;font-weight:700;color:#1c1c1c;text-align:center;">The more you fight, the more you get.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need to stop fighting.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need to get off the battlefield.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need to walk in a different direction.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">That's how you show your brain you don't care about fighting anymore.</p>
</td></tr>

<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">The questions that change the direction</h2>
</td></tr>

<tr><td style="padding:0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">How do you leave the battlefield?</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You do it with the power of questions. The power of questions is something I taught people at the LA workshop.</p>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions like:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>How do I fix this?</li>
<li>What's wrong with me?</li>
<li>Am I going to go crazy?</li>
<li>Why do I have these problems?</li>
<li>Why does this keep happening?</li>
<li>What if it gets worse?</li>
</ul>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself different questions:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>What do I want to spend my time on?</li>
<li>What do I want to grow?</li>
<li>What is useful?</li>
<li>What are useful actions?</li>
<li>What is my excitement?</li>
<li>What would I do if this wasn't here?</li>
<li>Who do I want to be in this moment?</li>
</ul>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And then you answer those questions in behaviors. Because <strong>the brain's language is behavior</strong>.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer questions. Once you have the answer, you navigate your life in that direction.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-style:italic;background:#f6f4ef;padding:18px 20px;border-left:3px solid #1c1c1c;">Ask yourself those questions right now while you're reading this email. You'll see you have a totally different answer.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">It's a whole different paradigm than asking how to fix things.</p>
</td></tr>

<tr><td style="padding:0 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 24px;"></div>
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is still chasing you</h2>
</td></tr>

<tr><td style="padding:0 32px;">
<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to attack you for some time.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You put firewood on this fire for years. It still has to burn.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">That's normal. You don't have to stop the fire. You just have to stop putting more wood on.</p>
</td></tr>

<tr><td style="padding:0 32px;">
<div style="background:#f6f4ef;padding:24px;border-radius:6px;margin:0 0 30px;">
<p style="margin:0 0 12px;font-size:15px;line-height:1.65;font-style:italic;color:#1c1c1c;">"I was able to unlock something I had been struggling with for years. It was one of the most welcoming events I've gone to. There was a sense of 'you are seen and you matter here.'"</p>
<p style="margin:0;font-size:14px;color:#666;">— Justina, May 30 LA workshop</p>
</div>
</td></tr>

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/image20.jpg?v=3" alt="LA workshop attendees" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:36px 32px 0 32px;">
<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">Why the LA workshop worked</h2>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The LA workshop was so powerful because everyone in the room was going in the same direction. Wanting to grow.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You have an environment of people who want to go in the same direction. You might not have that environment at home or wherever you are.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You can have that. It keeps you on track.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">When it keeps you on track, it keeps you going in the same direction. Away from the battlefield.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You show your brain you care about something else.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And you change your brain's algorithm.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You do that moment to moment. And it's a lot easier when you have people around you doing it too.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">So I'm launching this community July 1st.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list, so you get in before everyone else.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">You can get in right now for <strong>$49/month, locked forever</strong>.</p>
</td></tr>

<tr><td style="padding:0 32px 18px 32px;">
<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside:</h3>
<ul style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.85;">
<li>Weekly live call with me, Mondays 7pm Pacific</li>
<li>A room of people moving in the same direction</li>
<li>Meditation and EFT we do together</li>
<li>Direct access to me in the feed</li>
<li>Daily wins from the room</li>
<li>Future workshops drop here first</li>
</ul>

<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">Founding member bonuses (first 100 only):</h3>
<ul style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.85;">
<li>My Self-Worth Course included free ($99 value)</li>
<li>Monthly Founding Circle Zoom (just the 100 of you and me)</li>
<li>$50 off any future workshop</li>
<li>Founding Member badge</li>
<li>$49/month locked forever, even when standard goes to $97</li>
</ul>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">7-day free trial. Cancel in one click.</p>
</td></tr>

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/image30.jpg?v=3" alt="Connection at LA workshop" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:36px 32px 36px 32px;" align="center">
<p style="margin:0 0 24px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">Ready to come in?</p>

<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="background:#1c1c1c;border-radius:6px;">
<a href="https://starjessetaylor.com/whats-next?source=mailchimp_burn" style="display:inline-block;padding:18px 36px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Come in now → $49/month locked forever</a>
</td></tr></table>

<p style="margin:36px 0 0;font-size:15px;line-height:1.65;color:#444;">Your life's been on pause long enough.</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:#444;">I want to help you live a life of excitement.</p>
<p style="margin:18px 0 0;font-size:15px;color:#1c1c1c;font-weight:700;">— Star</p>
</td></tr>

<tr><td style="padding:0 32px 36px 32px;">
<div style="height:1px;background:#e6e2da;margin:8px 0 22px;"></div>
<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. If you want to keep hearing from me, the link above is also how you come over to my new email home. Same link, same place.</p>
</td></tr>

</table>
</td></tr></table>
</body>
</html>`;

const PLAIN_TEXT = `You keep waiting to feel ready before you live.

Are you tired of watching everyone else live their life while you fight what's in your head?

You see everyone else moving forward. They're not avoiding their passion. They're not staying in the safe job. They're not playing small in the room.

Why are they having an easier time flowing through life?

The answer is they're not fighting so much. They're not fighting on the battleground inside of their head. They don't even know what the battleground is.

They haven't taken their thoughts and emotions as seriously as you do.

Because you took them seriously, you engaged with them.

The problem is, the brain's language is engagement. Which means you showed the brain that you love to engage with the battlefield.

The brain gives you more of the battlefield.

The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.

The more you fight, the more you get.

You need to stop fighting. You need to get off the battlefield. You need to walk in a different direction.

That's how you show your brain you don't care about fighting anymore.

— [Continue reading for the teaching and the offer] —

Come in: https://starjessetaylor.com/whats-next?source=mailchimp_burn

— Star
`;

console.log('Updating campaign with v3 changes (hero, opening rewrite, stop-fighting rewrite, etc.)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({
    html: HTML,
    plain_text: PLAIN_TEXT,
  }),
});

console.log('✓ Updated. No test sent yet — Star still dictating.');
