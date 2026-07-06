#!/usr/bin/env node
/**
 * July 4 "Independence Method" email. Creates DRAFT in both AC and MailChimp.
 * Also sends a Mailchimp TEST to Star's inbox for review. Does NOT send to the list.
 */
import fs from 'fs';

const AC = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const MC = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));

const SUBJECT = 'Happy Independence Day. But are you free?';
const PREHEADER = 'Are you independent of your own head? A tool for this week, and a seat in every time zone.';
const FROM_NAME = 'Star Jesse Taylor';
const AC_FROM = 'star@starjessetaylor.com';
const MC_FROM = 'starjessetaylor@gmail.com';
const TEST_EMAIL = 'jessetaylortraxxx@gmail.com';
const SKOOL_URL = 'https://www.skool.com/star-jesse-taylor-3703';
const AC_LIST_ID = 3;              // Master Contact List
const MC_LIST_ID = 'cb74bd5290';   // Star Taylor
const CAMPAIGN_NAME = 'Independence Method (Jul 4 2026)';

const P = (t) => `<p style="margin:0 0 22px 0;">${t}</p>`;

const HTML = `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.7;font-size:17px;background:#ffffff;">

<div style="text-align:center;margin:0 0 32px 0;">
  <img src="https://starjessetaylor.com/images/email/star-hero.jpg" alt="Star Jesse Taylor" style="max-width:100%;height:auto;border-radius:12px;">
</div>

${P('Happy Fourth of July.')}
${P('Today the whole country celebrates independence. So let me ask you something. Are <em>you</em> independent? Not from a country. From your own head.')}
${P('Most people think they\'re just being themselves. They feel angry, they react. They feel jealous, they react. They get bored, they quit. And they call it "that\'s just who I am."')}
${P('But a lot of what feels like "you" isn\'t you. It\'s patterns. Old wiring. Beliefs you picked up from other people before you were old enough to say no to them.')}
${P('And those patterns quietly run your life. They pick your job. They pick who you date. They decide what you think you\'re allowed to want.')}
${P('And they talk to you. They tell you it\'s not the perfect day to post. They tell you you don\'t have the right feeling to start your business. They tell you you don\'t have the right vibration to move forward. They tell you you haven\'t healed your trauma yet, so you can\'t follow your passion.')}
${P('Every one of those is a lie the pattern tells to keep you exactly where you are. A pattern has one job. Keep you safe. And safe just means the same.')}
${P('That\'s not freedom. That\'s being reactive and calling it your personality.')}
${P('Here\'s the truth. You don\'t have to heal first. You don\'t need the perfect day, the right feeling, or the right vibration to begin. Those are the patterns talking. You move anyway, and the moving is what breaks them.')}
${P('I call it the <strong>Independence Method</strong>. It\'s practicing to live independently from your thoughts and emotions, and showing your brain you don\'t care about the old patterns anymore. And the only way to do that is to stop planning your life around how you feel.')}
${P('Think of it like a social media algorithm. When you react to the algorithm and keep watching the same videos, you feed it, and it gives you more of the same. Your brain is no different. React to the same thoughts and feelings, and you feed them, and you get more of the same life. You can\'t fix that by reacting harder. You set a new algorithm on purpose.')}
${P('You do it by anchoring your most important valued actions into your week. Pick the ones that actually build your life, the actions that grow your business, the ones that build your body, and put them on specific days at specific times. On purpose. Before the feeling gets a vote.')}
${P('Then the time comes, and your brain says, "we don\'t feel like it, let\'s do it later." That moment, right there, is the whole practice. You do it anyway. That is you showing your brain who is the boss. That is independence. Sometimes the action is even the thing you\'re excited about, like posting the video, and the pattern whispers "they\'re going to judge you." You post anyway.')}
${P('Here\'s what\'s really happening. Every time you do the action the feeling told you to skip, two things happen at once. You get more consistent. And you teach your brain that you don\'t care about the old pattern anymore. Because a pattern only survives when you react to it. That\'s how it feeds. So every time you don\'t react, your brain stops seeing it as useful, and it gets weaker. Less pull. Less grip. It slowly stops running. So over time you\'re not just more consistent, the old pattern has less and less power over you, because you stopped feeding it.')}
${P('And consistency is the whole game. Building your life is like building a house, brick by brick. Lay one, get distracted for a week, lay another, and it takes years. Keep laying bricks and it goes up fast. The old pattern is what pulls you off the bricks. Independence is what keeps you laying them.')}
${P('And here\'s what nobody tells you. Remember how this started? Thinking you were being yourself, when it was really the patterns running the show. This is where you actually become yourself, for the first time. When the patterns stop pulling you, the tornado of thoughts and emotions that was blurring your vision finally settles. And you can see. You find your alignment. You find what you actually care about, not what a scared version of you was handed. That is your true self. It was never gone. It was just buried under the noise.')}
${P('If you want help actually doing this, come build with us. It\'s $49 a month, with a one-week free trial, and inside we anchor these actions into your week together and keep you consistent.')}
${P('And now, wherever you are on the planet, there\'s a call with your name on it. One for the Americas, and a brand-new second call timed for everyone else. Morning across Europe, the Middle East, and India. Afternoon in Asia. Evening in Australia. No matter what time zone you wake up in, you finally have a seat.')}

<div style="text-align:center;margin:40px 0;">
  <a href="${SKOOL_URL}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:18px 40px;text-decoration:none;border-radius:10px;font-weight:700;font-size:18px;">Join the Community</a>
  <p style="font-size:13px;color:#777;margin-top:14px;">7-day free trial. $49/month after. Cancel anytime.</p>
</div>

<p style="margin:0 0 4px 0;">Happy Independence Day. Go be free.</p>
<p style="margin:0;">Star</p>

</body>
</html>`;

const PLAIN_TEXT = `Happy Fourth of July.

Today the whole country celebrates independence. So let me ask you something. Are you independent? Not from a country. From your own head.

Most people think they're just being themselves. They feel angry, they react. They feel jealous, they react. They get bored, they quit. And they call it "that's just who I am."

But a lot of what feels like "you" isn't you. It's patterns. Old wiring. Beliefs you picked up from other people before you were old enough to say no to them.

And those patterns quietly run your life. They pick your job. They pick who you date. They decide what you think you're allowed to want.

And they talk to you. They tell you it's not the perfect day to post. They tell you you don't have the right feeling to start your business. They tell you you don't have the right vibration to move forward. They tell you you haven't healed your trauma yet, so you can't follow your passion.

Every one of those is a lie the pattern tells to keep you exactly where you are. A pattern has one job. Keep you safe. And safe just means the same.

That's not freedom. That's being reactive and calling it your personality.

Here's the truth. You don't have to heal first. You don't need the perfect day, the right feeling, or the right vibration to begin. Those are the patterns talking. You move anyway, and the moving is what breaks them.

I call it the Independence Method. It's practicing to live independently from your thoughts and emotions, and showing your brain you don't care about the old patterns anymore. And the only way to do that is to stop planning your life around how you feel.

Think of it like a social media algorithm. When you react to the algorithm and keep watching the same videos, you feed it, and it gives you more of the same. Your brain is no different. React to the same thoughts and feelings, and you feed them, and you get more of the same life. You can't fix that by reacting harder. You set a new algorithm on purpose.

You do it by anchoring your most important valued actions into your week. Pick the ones that actually build your life, the actions that grow your business, the ones that build your body, and put them on specific days at specific times. On purpose. Before the feeling gets a vote.

Then the time comes, and your brain says, "we don't feel like it, let's do it later." That moment, right there, is the whole practice. You do it anyway. That is you showing your brain who is the boss. That is independence. Sometimes the action is even the thing you're excited about, like posting the video, and the pattern whispers "they're going to judge you." You post anyway.

Here's what's really happening. Every time you do the action the feeling told you to skip, two things happen at once. You get more consistent. And you teach your brain that you don't care about the old pattern anymore. Because a pattern only survives when you react to it. That's how it feeds. So every time you don't react, your brain stops seeing it as useful, and it gets weaker. Less pull. Less grip. It slowly stops running. So over time you're not just more consistent, the old pattern has less and less power over you, because you stopped feeding it.

And consistency is the whole game. Building your life is like building a house, brick by brick. Lay one, get distracted for a week, lay another, and it takes years. Keep laying bricks and it goes up fast. The old pattern is what pulls you off the bricks. Independence is what keeps you laying them.

And here's what nobody tells you. Remember how this started? Thinking you were being yourself, when it was really the patterns running the show. This is where you actually become yourself, for the first time. When the patterns stop pulling you, the tornado of thoughts and emotions that was blurring your vision finally settles. And you can see. You find your alignment. You find what you actually care about, not what a scared version of you was handed. That is your true self. It was never gone. It was just buried under the noise.

If you want help actually doing this, come build with us. It's $49 a month, with a one-week free trial, and inside we anchor these actions into your week together and keep you consistent.

And now, wherever you are on the planet, there's a call with your name on it. One for the Americas, and a brand-new second call timed for everyone else. Morning across Europe, the Middle East, and India. Afternoon in Asia. Evening in Australia. No matter what time zone you wake up in, you finally have a seat.

Join the community: ${SKOOL_URL}
7-day free trial. $49/month after. Cancel anytime.

Happy Independence Day. Go be free.
Star`;

// ─────────────── ACTIVECAMPAIGN ───────────────
const AC_API = AC.apiUrl.replace(/\/$/, '');
async function ac(path, opts = {}) {
  const r = await fetch(`${AC_API}${path}`, {
    ...opts,
    headers: { 'Api-Token': AC.apiKey, 'Content-Type': 'application/json', ...opts.headers },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`AC ${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : {};
}

let acCampaignId = null;
try {
  console.log('━━━ ActiveCampaign ━━━');
  const msg = await ac('/api/3/messages', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        fromemail: AC_FROM, fromname: FROM_NAME, reply2: AC_FROM,
        subject: SUBJECT, preheader: PREHEADER,
        html: HTML, text: PLAIN_TEXT, format: 'mime', htmlfetch: 0, textfetch: 0,
      },
    }),
  });
  const messageId = msg.message?.id;
  console.log(`  Message id: ${messageId}`);
  const camp = await ac('/api/3/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      campaign: {
        type: 'single', name: CAMPAIGN_NAME, sdate: null, status: 0, public: 1,
        mail_transfer: 0, tracklinks: 'all', track_reads: 1, track_links: 1,
        p: { [AC_LIST_ID]: 1 }, m: { [messageId]: 100 },
      },
    }),
  });
  acCampaignId = camp.campaign?.id;
  console.log(`  ✓ Draft campaign id: ${acCampaignId}`);
} catch (e) {
  console.error(`  ✗ AC failed: ${e.message}`);
}

// ─────────────── MAILCHIMP ───────────────
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

let mcCampaignId = null;
try {
  console.log('\n━━━ Mailchimp ━━━');
  const c = await mc('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      type: 'regular',
      recipients: { list_id: MC_LIST_ID },
      settings: {
        subject_line: SUBJECT, preview_text: PREHEADER, title: CAMPAIGN_NAME,
        from_name: FROM_NAME, reply_to: MC_FROM, auto_footer: false, inline_css: true,
      },
    }),
  });
  mcCampaignId = c.id;
  console.log(`  Campaign id: ${mcCampaignId}`);
  await mc(`/campaigns/${mcCampaignId}/content`, {
    method: 'PUT', body: JSON.stringify({ html: HTML, plain_text: PLAIN_TEXT }),
  });
  console.log('  ✓ Content set (DRAFT)');
  await mc(`/campaigns/${mcCampaignId}/actions/test`, {
    method: 'POST', body: JSON.stringify({ test_emails: [TEST_EMAIL], send_type: 'html' }),
  });
  console.log(`  ✓ Test email sent to ${TEST_EMAIL}`);
} catch (e) {
  console.error(`  ✗ MC failed: ${e.message}`);
}

// ─────────────── REPORT ───────────────
console.log('\n━━━ REVIEW ━━━');
if (acCampaignId) console.log(`AC edit: https://starjessetaylor92181.activehosted.com/campaign/${acCampaignId}/edit`);
if (mcCampaignId) console.log(`MC edit: https://us1.admin.mailchimp.com/campaigns/edit?id=${mcCampaignId}`);
console.log('\nBoth are DRAFT. Check the test email on your phone. Nothing sends to the list until you say so.');
