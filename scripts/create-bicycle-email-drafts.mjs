#!/usr/bin/env node
/**
 * Create the bicycle/momentum email as DRAFT in both AC and MailChimp.
 * Does NOT send. Star reviews in each platform first.
 */
import fs from 'fs';

const AC = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const MC = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));

const SUBJECT = 'life is like riding a bicycle';
const PREHEADER = '7-day free trial. No risk to try it.';
const FROM_NAME = 'Star Jesse Taylor';
const AC_FROM = 'star@starjessetaylor.com';
const MC_FROM = 'starjessetaylor@gmail.com';
const SKOOL_URL = 'https://www.skool.com/star-jesse-taylor-3703';
const AC_LIST_ID = 3; // Master Contact List
const MC_LIST_ID = 'cb74bd5290'; // Star Taylor

const HTML = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.6;">

<p style="margin: 0 0 24px 0;">There's a line from Albert Einstein I keep coming back to:</p>

<div style="text-align: center; margin: 24px 0;">
  <img src="https://starjessetaylor.com/images/einstein-bicycle.jpg" alt="Einstein on a bicycle" style="max-width: 100%; height: auto; border-radius: 8px;">
</div>

<p style="font-style: italic; font-size: 18px; text-align: center; margin: 24px 0; color: #444;">"Life is like riding a bicycle. To keep your balance, you have to keep moving."</p>

<p>This is so true. When you stay stagnant and don't move out of fear, everything falls apart. That's why momentum is so important.</p>

<p>Do you wish you had momentum but feel like your brain is fighting you, your brain is sabotaging you?</p>

<p>When you keep moving forward, your brain stops being the loudest voice. The pull of anxiety, the loop of overthinking, the urge to scroll. They all quiet down because you're moving. You don't have to fight them. You just pedal.</p>

<p>But when you stop, your brain takes over.</p>

<p>You start rehearsing the conversation you should be having instead of having it.</p>

<p>You cancel the plans.</p>

<p>You scroll instead of doing.</p>

<p>You convince yourself today's not the day.</p>

<p>You tell yourself you'll start when you feel ready.</p>

<p>You read another book instead of doing the thing.</p>

<p>Each one of those is your brain pulling you off the path. And the longer you stand still, the harder it is to get back on the bike.</p>

<p style="font-weight: 600; font-size: 18px;">Momentum is the medicine. Staying on track is how you get it.</p>

<p>But how do you stay on track when your brain seems to always try to pull you off?</p>

<p style="font-weight: 600;">You need support.</p>

<p>Imagine being part of a like-minded community of people, all going in the same direction. Imagine weekly calls with me and the group to keep your momentum. Imagine having people who remind you to stay on track when your brain tries to pull you away.</p>

<div style="text-align: center; margin: 32px 0;">
  <img src="https://starjessetaylor.com/images/LA%20Workshop%20May%2030/star-speaking-workshop.png" alt="Star teaching at the LA workshop" style="max-width: 100%; height: auto; border-radius: 8px;">
</div>

<p>That's why I built the Audacity community. Real teaching, real conversations, my actual presence inside daily. We keep each other moving so the brain doesn't get the last word.</p>

<p>If you're tired of pedaling and falling off, of starting again and getting kicked off the path, I'm going to help you get your momentum.</p>

<p style="margin-top: 32px;"><strong>One thing before you join.</strong> I'm protective of this community.</p>

<p>It's for good-hearted people who want to grow their life and grow a community.</p>

<p style="margin: 8px 0;">It's not for people who only want to take.</p>
<p style="margin: 8px 0;">It's not for people who are lazy.</p>
<p style="margin: 8px 0;">It's not for people looking for quick tricks.</p>

<p>If that's you, you don't belong in this room. If you actually want to grow, the door is open.</p>

<div style="text-align: center; margin: 40px 0;">
  <a href="${SKOOL_URL}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 17px;">Join the Audacity Community</a>
  <p style="font-size: 13px; color: #777; margin-top: 12px;">7-day free trial. No risk to try.</p>
</div>

<p style="margin-top: 32px;">Star</p>

</body>
</html>`;

const PLAIN_TEXT = `There's a line from Albert Einstein I keep coming back to:

"Life is like riding a bicycle. To keep your balance, you have to keep moving."

This is so true. When you stay stagnant and don't move out of fear, everything falls apart. That's why momentum is so important.

Do you wish you had momentum but feel like your brain is fighting you, your brain is sabotaging you?

When you keep moving forward, your brain stops being the loudest voice. The pull of anxiety, the loop of overthinking, the urge to scroll. They all quiet down because you're moving. You don't have to fight them. You just pedal.

But when you stop, your brain takes over.

You start rehearsing the conversation you should be having instead of having it.

You cancel the plans.

You scroll instead of doing.

You convince yourself today's not the day.

You tell yourself you'll start when you feel ready.

You read another book instead of doing the thing.

Each one of those is your brain pulling you off the path. And the longer you stand still, the harder it is to get back on the bike.

Momentum is the medicine. Staying on track is how you get it.

But how do you stay on track when your brain seems to always try to pull you off?

You need support.

Imagine being part of a like-minded community of people, all going in the same direction. Imagine weekly calls with me and the group to keep your momentum. Imagine having people who remind you to stay on track when your brain tries to pull you away.

That's why I built the Audacity community. Real teaching, real conversations, my actual presence inside daily. We keep each other moving so the brain doesn't get the last word.

If you're tired of pedaling and falling off, of starting again and getting kicked off the path, I'm going to help you get your momentum.

One thing before you join. I'm protective of this community.

It's for good-hearted people who want to grow their life and grow a community.

It's not for people who only want to take.
It's not for people who are lazy.
It's not for people looking for quick tricks.

If that's you, you don't belong in this room. If you actually want to grow, the door is open.

Join the Audacity community: ${SKOOL_URL}
7-day free trial. No risk to try.

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
  console.log('Creating message...');
  const msg = await ac('/api/3/messages', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        fromemail: AC_FROM,
        fromname: FROM_NAME,
        reply2: AC_FROM,
        subject: SUBJECT,
        preheader: PREHEADER,
        html: HTML,
        text: PLAIN_TEXT,
        format: 'mime',
        htmlfetch: 0,
        textfetch: 0,
      },
    }),
  });
  const messageId = msg.message?.id;
  console.log(`  Message id: ${messageId}`);

  console.log('Creating draft campaign...');
  const camp = await ac('/api/3/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      campaign: {
        type: 'single',
        name: 'Audacity launch — Einstein bicycle (Jun 29 2026)',
        sdate: null,
        status: 0,
        public: 1,
        mail_transfer: 0,
        tracklinks: 'all',
        track_reads: 1,
        track_links: 1,
        p: { [AC_LIST_ID]: 1 },
        m: { [messageId]: 100 },
      },
    }),
  });
  acCampaignId = camp.campaign?.id;
  console.log(`  ✓ Campaign id: ${acCampaignId} (DRAFT)`);
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
  console.log('Creating draft campaign...');
  const c = await mc('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      type: 'regular',
      recipients: { list_id: MC_LIST_ID },
      settings: {
        subject_line: SUBJECT,
        preview_text: PREHEADER,
        title: 'Audacity launch — Einstein bicycle (Jun 29 2026)',
        from_name: FROM_NAME,
        reply_to: MC_FROM,
        auto_footer: false,
        inline_css: true,
      },
    }),
  });
  mcCampaignId = c.id;
  console.log(`  Campaign id: ${mcCampaignId}`);

  console.log('Setting HTML content...');
  await mc(`/campaigns/${mcCampaignId}/content`, {
    method: 'PUT',
    body: JSON.stringify({
      html: HTML,
      plain_text: PLAIN_TEXT,
    }),
  });
  console.log(`  ✓ Content set (DRAFT)`);
} catch (e) {
  console.error(`  ✗ MC failed: ${e.message}`);
}

// ─────────────── REPORT ───────────────
console.log('\n━━━ EDIT URLS ━━━');
if (acCampaignId) {
  console.log(`AC: https://starjessetaylor92181.activehosted.com/campaign/${acCampaignId}/edit`);
}
if (mcCampaignId) {
  console.log(`MC: https://us1.admin.mailchimp.com/campaigns/edit?id=${mcCampaignId}`);
}
console.log('\nBoth are DRAFT. Review in each platform. Hit "Send" when ready.');
