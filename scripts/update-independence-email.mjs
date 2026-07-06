#!/usr/bin/env node
/**
 * Refresh the Mailchimp draft (5d7a32356a): line-by-line spacing, what's-inside list,
 * both call times, brick image. Updates content, re-sends test. Does NOT send to list.
 */
import fs from 'fs';

const MC = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const CAMPAIGN_ID = '5d7a32356a';
const TEST_EMAIL = 'jessetaylortraxxx@gmail.com';
const SKOOL_URL = 'https://www.skool.com/star-jesse-taylor-3703';
const STAR_IMG = 'https://mcusercontent.com/215226e39658cbe754f52f270/images/b9495246-7289-49d3-79e7-ea6b62a58d3f.jpg';
const BRICK_IMG = 'https://mcusercontent.com/215226e39658cbe754f52f270/images/7b9af22e-7362-0192-1787-09cc90576dff.jpg';
const SUBJECT = 'How to be authentic';
const PREHEADER = 'One free week of live coaching with me inside';

const mcAuth = `Basic ${Buffer.from(`apikey:${MC.api_key}`).toString('base64')}`;
async function mc(path, opts = {}) {
  const r = await fetch(`https://${MC.server}.api.mailchimp.com/3.0${path}`, {
    ...opts,
    headers: { Authorization: mcAuth, 'Content-Type': 'application/json', ...opts.headers },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`MC ${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : {};
}

const S = 'margin:0 0 16px 0;';       // standard line
const G = 'margin:26px 0 16px 0;';    // line that starts a new beat (extra space above)

const HTML = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.6;font-size:17px;background:#ffffff;">

<div style="text-align:center;margin:0 0 32px 0;"><img src="${STAR_IMG}" alt="Star Jesse Taylor" style="max-width:100%;height:auto;border-radius:12px;"></div>

<p style="${S}">Hope you had a good Independence Day.</p>
<p style="${S}">Yesterday the whole country celebrated its independence. The fireworks are over.</p>
<p style="${S}">So let me ask you the question that actually matters. Are <em>you</em> independent?</p>
<p style="${S}">Not from a country. From your own emotions and thoughts.</p>
<p style="${G}">Most people think they're just being themselves.</p>
<p style="${S}">They feel angry, they react. They feel jealous, they react. They get bored, they quit.</p>
<p style="${S}">And they call it "that's just who I am."</p>
<p style="${G}">But a lot of what feels like "you" isn't you.</p>
<p style="${S}">It's patterns. Old wiring. Beliefs you picked up from other people before you were old enough to say no to them.</p>
<p style="${S}">And those patterns quietly run your life.</p>
<p style="${S}">They pick your job. They pick who you date. They decide what you think you're allowed to want.</p>
<p style="${G}">And they talk to you.</p>
<p style="${S}">They tell you it's not the perfect day to post.</p>
<p style="${S}">They tell you you don't have the right feeling to start your business.</p>
<p style="${S}">They tell you you don't have the right vibration to move forward.</p>
<p style="${S}">They tell you you haven't healed your trauma yet, so you can't follow your passion.</p>
<p style="${G}">Every one of those is a lie the pattern tells to keep you exactly where you are.</p>
<p style="${S}">A pattern has one job. Keep you safe. And safe just means the same.</p>
<p style="${S}">That's not freedom. That's being reactive and calling it your personality.</p>
<p style="${G}">Here's the truth.</p>
<p style="${S}">You don't have to heal first. You don't need the perfect day, the right feeling, or the right vibration to begin.</p>
<p style="${S}">Those are the patterns talking.</p>
<p style="${S}">You move anyway, and the moving is what breaks them.</p>
<p style="${G}">I call it the <strong>Independence Method</strong>.</p>
<p style="${S}">It's practicing to live independently from your thoughts and emotions, and showing your brain you don't care about the old patterns anymore.</p>
<p style="${S}">And the only way to do that is to stop planning your life around how you feel.</p>
<p style="${G}">Think about how a social media algorithm works.</p>
<p style="${S}">The more you watch a certain kind of video, the more of it it feeds you. You react to it, and it gives you more of the same.</p>
<p style="${S}">Your brain is no different.</p>
<p style="${S}">React to the same thoughts and feelings, and you feed them, and you get more of the same life.</p>
<div style="text-align:center;margin:22px 0 26px 0;"><img src="https://mcusercontent.com/215226e39658cbe754f52f270/images/ea5292ea-36d9-a48c-86a1-8e95139cdc6f.png" alt="A phone feeding you more of the same, like an algorithm" style="max-width:100%;height:auto;border-radius:12px;"></div>
<p style="${S}">You can't fix that by reacting harder.</p>
<p style="${S}">And you can't fix it by trying to fix it either. Trying to fix it is still watching the same video. It's still watch time, so the algorithm, and your brain, just give you more of the same.</p>
<p style="${S}">The only way out is to stop feeding it. You set a new algorithm on purpose.</p>
<p style="${G}">Here is the logic.</p>
<p style="${S}">The old algorithm is constantly recreated through reactivity. Every time you react, you build it again.</p>
<p style="${S}">So the solution has to be the exact opposite. Proactivity.</p>
<p style="${S}">And you get proactive by shifting to the one thing your brain cannot control. Your actions.</p>
<p style="${S}">Your brain has full access to your emotions and your thoughts. It can hand you a new one every second, all day long. But it has no access to your actions.</p>
<p style="${G}">So you start by setting your most important valued actions as anchors into your week. That is what starts your journey on the new proactive valued action engine.</p>
<p style="${S}">Think of it like setting up cones at a kids' soccer practice. The cones tell them which way to run and dribble.</p>
<p style="${S}">You set up cones for yourself, so you know your direction.</p>
<p style="${S}">A cone might be "go to the gym three times this week." But you can't just say "go to the gym three times." That's still left up to how you feel.</p>
<p style="${S}">You set it on purpose. Specific days, specific times. Before the feeling gets a vote.</p>
<p style="${S}">Pick the ones that actually build your life. The actions that grow your business. The ones that build your body.</p>
<p style="${G}">Then the time comes, and your brain says, "we don't feel like it, let's do it later."</p>
<p style="${S}">That moment, right there, is the whole practice.</p>
<p style="${S}">You do it anyway.</p>
<p style="${S}">That is you being the boss. Not asking who's in charge. You are. That is independence. Independence from the patterns.</p>
<p style="${S}">And your brain is not going to like it. Reacting to the pattern is familiar, and familiar feels safe. It's a protective mechanism. So a lot of the time your brain just screams louder that everything needs to be okay.</p>
<p style="${S}">You keep moving anyway, in the direction of your excitement, your values, the things that actually matter to you.</p>
<p style="${S}">Sometimes the action is even the thing you're excited about. You go to post the video, and the pattern whispers "they're going to judge you."</p>
<p style="${S}">You post anyway.</p>
<p style="${G}">Here's what's really happening.</p>
<p style="${S}">Every time you do the action the feeling told you to skip, two things happen at once.</p>
<p style="${S}">You get more consistent.</p>
<p style="${S}">And you teach your brain that you don't care about the old pattern anymore.</p>
<p style="${S}">Because a pattern only survives when you react to it. That's how it feeds.</p>
<p style="${S}">So every time you don't react, your brain stops seeing it as useful, and it gets weaker.</p>
<p style="${S}">Less pull. Less grip. It slowly stops running.</p>
<p style="${S}">So over time you're not just more consistent. The old pattern has less and less power over you, because you stopped feeding it.</p>

<p style="${S}">And consistency is the whole game.</p>
<p style="${S}">Building your life is like building a house, brick by brick.</p>
<p style="${S}">Lay one, get distracted for a week, lay another, and it takes years.</p>
<p style="${S}">Keep laying bricks and it goes up fast.</p>
<p style="${S}">The old pattern is what pulls you off the bricks. Independence is what keeps you laying them.</p>
<div style="text-align:center;margin:22px 0 26px 0;"><img src="https://mcusercontent.com/215226e39658cbe754f52f270/images/60867a54-36f9-b852-9dd3-4b6743efa573.jpg" alt="Laying bricks, one at a time" style="max-width:100%;height:auto;border-radius:12px;"></div>
<p style="${G}">And here's what nobody tells you.</p>
<p style="${S}">Remember how this started? Thinking you were being yourself, when it was really the patterns running the show.</p>
<p style="${S}">This is where you actually become yourself, for the first time.</p>
<p style="${S}">When the patterns stop pulling you, the tornado of thoughts and emotions that was blurring your vision finally settles.</p>
<p style="${S}">And you can see.</p>
<p style="${S}">You find your alignment. You find what you actually care about, not what a scared version of you was handed.</p>
<p style="${S}">That is your true self.</p>
<p style="${S}">It was never gone. It was just buried under the noise.</p>
<p style="${G}">Make yourself independent. Free yourself from the noise.</p>
<p style="${G}">Now you can close this email and go back to your day.</p>
<p style="${S}">That's familiarity. That's what the pattern wants.</p>
<p style="${S}">Then tomorrow is today again. The same familiar patterns, the same fighting your own brain, the same overthinking, the same intrusive thoughts, the same anxiety calling the shots, the same you playing small, waiting to feel ready for a life that keeps not arriving.</p>
<p style="${S}">That's the real cost. Not one bad day. A whole life spent on the sidelines of your own life, watching everyone else live theirs.</p>
<p style="${S}">Or you start breaking the pattern now, with people doing the exact same thing right beside you.</p>

<div style="margin:26px 0;padding:20px;background:#f6f6f4;border-radius:12px;"><p style="font-style:italic;color:#333;margin:0 0 14px 0;">"I'm a psychologist. I've read so many self-help books. But this is what actually changed things."</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:12px;"><img src="https://mcusercontent.com/215226e39658cbe754f52f270/images/1b514e96-0050-ad89-8ce2-34e556d84aeb.jpg" alt="Annabelle Twigt" width="54" height="54" style="width:54px;height:54px;border-radius:50%;object-fit:cover;display:block;"></td><td style="vertical-align:middle;"><div style="font-weight:700;color:#1a1a1a;font-size:15px;">Annabelle Twigt</div><div style="font-size:13px;color:#777;">Psychologist</div></td></tr></table></div>

<p style="margin:28px 0 12px 0;font-weight:700;">Inside the community:</p>
<p style="margin:0 0 10px 0;">✓&nbsp; A weekly live call with me</p>
<p style="margin:0 0 10px 0;">✓&nbsp; Ask me your questions right in the feed</p>
<p style="margin:0 0 20px 0;">✓&nbsp; A good-hearted community that creates an atmosphere of supportive growth and accountability</p>
<p style="${S}">It's $49 a month, with a one-week free trial.</p>

<p style="margin:24px 0 10px 0;font-weight:700;">The next calls, across different time zones:</p>
<p style="margin:0 0 8px 0;">Monday, July 6, 4 PM Pacific</p>
<p style="margin:0 0 8px 0;">Wednesday, July 8, 12 AM Pacific (Tuesday night into Wednesday). Morning in Europe, afternoon in Asia, evening in Australia.</p>
<p style="margin:0 0 8px 0;">Monday, July 13, 6 PM Pacific</p>
<p style="margin:0 0 20px 0;">Tuesday, July 14, 12 PM Pacific</p>

<div style="text-align:center;margin:32px 0;">
  <a href="${SKOOL_URL}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:18px 40px;text-decoration:none;border-radius:10px;font-weight:700;font-size:18px;">Join the Community</a>
  <p style="font-size:13px;color:#777;margin-top:14px;">7-day free trial. $49/month after. Cancel anytime.</p>
</div>

<div style="text-align:center;margin:28px 0 24px 0;"><img src="https://starjessetaylor.com/images/email/star-hero.jpg" alt="Star Jesse Taylor" style="max-width:100%;height:auto;border-radius:12px;"></div>

<p style="margin:16px 0 4px 0;">Go be free.</p>
<p style="margin:0;">Star</p>

<p style="margin:28px 0 0 0;font-size:15px;color:#333;line-height:1.55;">P.S. One more thing. I've been building an app called Audacity. It's more than an app. It has so many tools to help you live a lighter, more successful life. Community members get access even though it's not public yet, so you get to use it, test it, and give me feedback so I can make it even better.</p>

</body>
</html>`;

const PLAIN_TEXT = `Hope you had a good Independence Day.

Yesterday the whole country celebrated its independence. The fireworks are over.

So let me ask you the question that actually matters. Are you independent?

Not from a country. From your own emotions and thoughts.

Most people think they're just being themselves.

They feel angry, they react. They feel jealous, they react. They get bored, they quit.

And they call it "that's just who I am."

But a lot of what feels like "you" isn't you.

It's patterns. Old wiring. Beliefs you picked up from other people before you were old enough to say no to them.

And those patterns quietly run your life.

They pick your job. They pick who you date. They decide what you think you're allowed to want.

And they talk to you.

They tell you it's not the perfect day to post.

They tell you you don't have the right feeling to start your business.

They tell you you don't have the right vibration to move forward.

They tell you you haven't healed your trauma yet, so you can't follow your passion.

Every one of those is a lie the pattern tells to keep you exactly where you are.

A pattern has one job. Keep you safe. And safe just means the same.

That's not freedom. That's being reactive and calling it your personality.

Here's the truth.

You don't have to heal first. You don't need the perfect day, the right feeling, or the right vibration to begin.

Those are the patterns talking.

You move anyway, and the moving is what breaks them.

I call it the Independence Method.

It's practicing to live independently from your thoughts and emotions, and showing your brain you don't care about the old patterns anymore.

And the only way to do that is to stop planning your life around how you feel.

Think about how a social media algorithm works.

The more you watch a certain kind of video, the more of it it feeds you. You react to it, and it gives you more of the same.

Your brain is no different.

React to the same thoughts and feelings, and you feed them, and you get more of the same life.

You can't fix that by reacting harder.

And you can't fix it by trying to fix it either. Trying to fix it is still watching the same video. It's still watch time, so the algorithm, and your brain, just give you more of the same.

The only way out is to stop feeding it. You set a new algorithm on purpose.

Here is the logic.

The old algorithm is constantly recreated through reactivity. Every time you react, you build it again.

So the solution has to be the exact opposite. Proactivity.

And you get proactive by shifting to the one thing your brain cannot control. Your actions.

Your brain has full access to your emotions and your thoughts. It can hand you a new one every second, all day long. But it has no access to your actions.

So you start by setting your most important valued actions as anchors into your week. That is what starts your journey on the new proactive valued action engine.

Think of it like setting up cones at a kids' soccer practice. The cones tell them which way to run and dribble.

You set up cones for yourself, so you know your direction.

A cone might be "go to the gym three times this week." But you can't just say "go to the gym three times." That's still left up to how you feel.

You set it on purpose. Specific days, specific times. Before the feeling gets a vote.

Pick the ones that actually build your life. The actions that grow your business. The ones that build your body.

Then the time comes, and your brain says, "we don't feel like it, let's do it later."

That moment, right there, is the whole practice.

You do it anyway.

That is you being the boss. Not asking who's in charge. You are. That is independence. Independence from the patterns.

And your brain is not going to like it. Reacting to the pattern is familiar, and familiar feels safe. It's a protective mechanism. So a lot of the time your brain just screams louder that everything needs to be okay.

You keep moving anyway, in the direction of your excitement, your values, the things that actually matter to you.

Sometimes the action is even the thing you're excited about. You go to post the video, and the pattern whispers "they're going to judge you."

You post anyway.

Here's what's really happening.

Every time you do the action the feeling told you to skip, two things happen at once.

You get more consistent.

And you teach your brain that you don't care about the old pattern anymore.

Because a pattern only survives when you react to it. That's how it feeds.

So every time you don't react, your brain stops seeing it as useful, and it gets weaker.

Less pull. Less grip. It slowly stops running.

So over time you're not just more consistent. The old pattern has less and less power over you, because you stopped feeding it.

And consistency is the whole game.

Building your life is like building a house, brick by brick.

Lay one, get distracted for a week, lay another, and it takes years.

Keep laying bricks and it goes up fast.

The old pattern is what pulls you off the bricks. Independence is what keeps you laying them.

And here's what nobody tells you.

Remember how this started? Thinking you were being yourself, when it was really the patterns running the show.

This is where you actually become yourself, for the first time.

When the patterns stop pulling you, the tornado of thoughts and emotions that was blurring your vision finally settles.

And you can see.

You find your alignment. You find what you actually care about, not what a scared version of you was handed.

That is your true self.

It was never gone. It was just buried under the noise.

Make yourself independent. Free yourself from the noise.

Now you can close this email and go back to your day.

That's familiarity. That's what the pattern wants.

Then tomorrow is today again. The same familiar patterns, the same fighting your own brain, the same overthinking, the same intrusive thoughts, the same anxiety calling the shots, the same you playing small, waiting to feel ready for a life that keeps not arriving.

That's the real cost. Not one bad day. A whole life spent on the sidelines of your own life, watching everyone else live theirs.

Or you start breaking the pattern now, with people doing the exact same thing right beside you.

"I'm a psychologist. I've read so many self-help books. But this is what actually changed things."
- Annabelle Twigt, Psychologist

INSIDE THE COMMUNITY:
- A weekly live call with me
- Ask me your questions right in the feed
- A good-hearted community that creates an atmosphere of supportive growth and accountability

It's $49 a month, with a one-week free trial.

THE NEXT CALLS, ACROSS DIFFERENT TIME ZONES:
Monday, July 6, 4 PM Pacific
Wednesday, July 8, 12 AM Pacific (Tuesday night into Wednesday). Morning in Europe, afternoon in Asia, evening in Australia.
Monday, July 13, 6 PM Pacific
Tuesday, July 14, 12 PM Pacific

Join the community: ${SKOOL_URL}
7-day free trial. $49/month after. Cancel anytime.

Go be free.
Star

P.S. One more thing. I've been building an app called Audacity. It's more than an app. It has so many tools to help you live a lighter, more successful life. Community members get access even though it's not public yet, so you get to use it, test it, and give me feedback so I can make it even better.`;

if (process.env.DUMP_ONLY) {
  fs.writeFileSync(process.env.DUMP_HTML, HTML);
  fs.writeFileSync(process.env.DUMP_PLAIN, PLAIN_TEXT);
  console.log(`Dumped raw HTML ${HTML.length} + plain ${PLAIN_TEXT.length}`);
  process.exit(0);
}

await mc(`/campaigns/${CAMPAIGN_ID}`, {
  method: 'PATCH',
  body: JSON.stringify({ settings: { subject_line: SUBJECT, preview_text: PREHEADER } }),
});
console.log('  ✓ Subject + preview updated');
console.log('Updating draft content (line-by-line, list, both calls)...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html: HTML, plain_text: PLAIN_TEXT }),
});
console.log('  ✓ Content updated');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }),
});
console.log(`  ✓ Fresh test sent to ${TEST_EMAIL}`);
console.log('\nCheck your phone. Still a DRAFT. Nothing sent to the list.');
