#!/usr/bin/env node
/**
 * v14 — Apply tonight's locks to the workshop email.
 *
 * Changes:
 *  1. Hook opener — add "carefree" per Star's locked Hook C update
 *  2. Replace bloated "Get support" section with Star's tighter dictation + 4 workshop steps
 *  3. Updated bullets: workshop name (From Anxiety to Confidence), EFT spelled out,
 *     drop Wins of the Day, add Audacity beta
 *  4. Pricing line: drop the "$97" line (founding rate deferred until ~100 members)
 *  5. Add 30-day dual money-back guarantee
 *  6. Update subject line to Star's new carefree variant
 *  7. "Staying On Track calls" → "live calls" (no internal jargon)
 *
 * Workflow:
 *  - Loads current MailChimp HTML
 *  - Applies all replacements
 *  - Saves locally for Star's preview (workshop-email-v14-PREVIEW.html)
 *  - Opens in browser
 *  - Does NOT push to MailChimp — separate push script after Star approves
 */

import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const API_KEY = CONFIG.api_key;
const SERVER = CONFIG.server;
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';
const PREVIEW_FILE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v14-PREVIEW.html';

const AUTH_HEADER = `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`;

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MailChimp API error ${res.status}:`, text.slice(0, 300)); throw new Error(`API call failed: ${path}`); }
  return text ? JSON.parse(text) : {};
}

console.log('Fetching current campaign content...');
const current = await mc(`/campaigns/${CAMPAIGN_ID}/content`);
let html = current.html;

function applyReplace(label, oldText, newText) {
  if (html.includes(newText)) {
    console.log(`= ${label} (already applied, skipping)`);
    return;
  }
  if (!html.includes(oldText)) {
    console.error(`✗ FAILED to find: ${label}`);
    console.error(`  Looking for: ${oldText.slice(0, 100)}...`);
    process.exit(1);
  }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// ============================================================
// CHANGE 1: Hook C — add "carefree"
// ============================================================
applyReplace(
  'Hook C: add "carefree"',
  `Are you tired of watching everyone else live their life while you fight what's in your head?`,
  `Are you tired of watching everyone else live their life carefree while you fight what's in your head?`
);

// Star Jun 28 PM: present tense + concrete inner-dialogue example
applyReplace(
  'Body: present tense + carefree-inner-dialogue example',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">They haven't taken their thoughts and emotions as seriously as you do.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">They don't take their thoughts and emotions as seriously as you do. When intense thoughts or emotions come up, they say, "Oh what a weird thing. I guess it's one of those days. Whatever. Let's move forward with our valued actions as well as we can."</p>`
);

// Star Jun 28 PM: rewrite the entire "brain pulls you back" section with new expanded content
applyReplace(
  'Section header: "How you actually stay off the battlefield"',
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>`,
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">How you actually stay off the battlefield</h2>`
);

applyReplace(
  'Replace entire post-fire-image content block with expanded teaching',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is still going to try to pull you back into the thoughts and emotions.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Don't think just because you changed direction, the brain is not trying to chase after you.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">This is because you showed your brain for a long time that you want to be on the battleground.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">It's like a fire that has to keep burning for a while because you kept adding firewood to it.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The firewood you kept adding is the engagement with your thoughts and emotions.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Over time, when you don't engage anymore, the fire is going to stop burning. You're going to stop giving it oxygen.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The community gives you support to stay off the battlefield. Over time, more time off the battlefield shows the brain you don't care about the battlefield anymore. The battlefield disappears. But you have to stay off it long enough.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Don't think the battlefield just disappears because you decided to walk away from it. You taught your brain that you love to battle with thoughts and emotions. Your brain is still going to try to pull you back. It will give you:</p>

<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>Urges</li>
<li>Excessive anxiety</li>
<li>Panic attacks</li>
<li>Intrusive thoughts</li>
<li>Bodily sensations</li>
</ul>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Don't think that just because you changed direction for a few weeks, the brain isn't trying to chase after you.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Think of it like this. The battlefield is a fire. Your engagement is the firewood. Over the years, you kept adding firewood. The fire got big, big, big. A strong fire.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Just because you are walking away from the fire and stopping the firewood doesn't mean there isn't still enough firewood on the fire to keep burning for a while. You need to accept that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The good news is that over time, when you don't engage anymore and you change the direction of your focus, the fire stops burning. It runs out of oxygen. The oxygen is the engagement.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You want to build a new fire. A better fire. A fire of your passions, your valued actions, your values, your support.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Better yet, you want to walk away from the fire entirely and create a garden. A garden you nurture with water and sunshine through your actions. A garden that grows over time. A garden that ends up supporting you.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">That's how you change your brain's algorithm. That's how you let go of the pain you've been carrying.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Instead of fighting, you follow your passions like those other people you see. You live carefree. You walk into a room carefree. You have conversations being yourself, carefree. No more head on the battleground.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Over my past six years of coaching, building communities, and working with people, I've seen one thing again and again. People need support to stay on track. The brain always pulls them back without it.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">That's why I created something amazing that launches July 1st.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">A community. A place I nurture like a garden. A culture that is itself a garden. Where everyone builds their own garden inside, to stay on track. And when we grow the garden of the community together, it nurtures all of us.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The community lives on Skool, an amazing community app where you'll find everything in one place.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;font-weight:600;">You get the chance to enter the community before July 1st because you're getting this email. You're one of the first I want in the room.</p>`
);

// Star Jun 28 PM: add support-transition line before "brain trying to pull you back" h2
applyReplace(
  'Add "if you need support" transition line before new h2',
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">How you actually stay off the battlefield</h2>`,
  `<p style="margin:0 0 30px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">If you need support to walk off the battlefield in the direction of the life that you want to live, keep reading.</p>

<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">How you actually stay off the battlefield</h2>`
);

// Star Jun 28 PM: drop "Ask yourself those questions right now..." blockquote + "whole different paradigm" line
applyReplace(
  'Drop "ask yourself right now" blockquote + "whole different paradigm" line',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-style:italic;background:#f6f4ef;padding:18px 20px;border-left:3px solid #1c1c1c;">Ask yourself those questions right now while you're reading this email. You see that you have totally different answers from when you asked before.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">It's a whole different paradigm than asking how to fix things.</p>`,
  ``
);

// Star Jun 28 PM: replace post-questions block with new content (ties engagement framing back)
applyReplace(
  'Replace post-questions block with new engagement-tied content',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The more you do those actions, the more they become normal. They become familiar to the brain. You become more confident in those situations. You become more confident living your life. The life that you want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer the questions. So ask the questions that support you. Once you have the answer, you navigate your life in that direction.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The answers you get to the healthy questions come in the form of behaviors and actions. Following those actions in the moment, when you feel resistance and think you have to fix emotions, shows your brain you want to create a new algorithm.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Even though those emotions are changing your level of engagement, remember the language of the brain is engagement. Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The more you do those actions while spending time outside of your head, the more they become normal. They become familiar to your brain. You become more confident in those situations. You become more confident living your life. The life that you want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is a question-answering machine. Ask the questions that support you moving in a healthy direction. Once you have the answer, you navigate your life in that direction.</p>`
);

// Star Jun 28 PM: reframe bad-questions intro
applyReplace(
  'Bad questions intro: questions that create more mental health problems',
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions like:</p>`,
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions that create more mental health problems:</p>`
);

// Star Jun 28 PM: reframe good-questions intro
applyReplace(
  'Good questions intro: show brain you care about living your life',
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself different questions:</p>`,
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself questions that show your brain that, instead of fixing emotions and thoughts, you care about living your life:</p>`
);

// Star Jun 28 PM: drop the "brain's language is behavior" line (conflicts with engagement)
applyReplace(
  'Drop "brain\'s language is behavior" line (conflicts with engagement framing)',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Then you answer those questions in behaviors and actions. Because <strong>the brain's language is behavior</strong>.</p>

`,
  ``
);

// Star Jun 28 PM: remove "Who do I want to be in this moment?" from useful questions list
applyReplace(
  'Remove "Who do I want to be in this moment?" from useful questions list',
  `<li>Who do I want to be in this moment?</li>
`,
  ``
);

// Star Jun 28 PM: replace "The brain created..." with cleaner version
applyReplace(
  'Replace "brain created more excessive thoughts" with cleaner attacking-you version',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">In the beginning, you engaged with thoughts and emotions other people don't engage with. By engaging, you gave your brain the signal to give you those thoughts automatically. Now the brain gives you those thoughts right when you wake up and at random times during the day. It feels like the brain is attacking you.</p>`
);

// Star Jun 28 PM: continuity — "Then the brain gives you more of the battlefield"
applyReplace(
  'Add "Then" to brain-gives-you-more-battlefield for continuity',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain gives you more of the battlefield.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Then the brain gives you more of the battlefield.</p>`
);

// Star Jun 28 PM: add "but you take them seriously" + catastrophizing inner-dialogue examples + new transition
applyReplace(
  'Replace old "Because you took them seriously" with you-take-them-seriously block + transition',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Because you took them seriously, you engaged with them.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">But you take them seriously, and you say to yourself:</p>

<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>"Oh no, what does that mean about me to have those thoughts?"</li>
<li>"What if this anxiety gets worse?"</li>
<li>"What if this anxiety never goes away?"</li>
<li>"What if this leads to a panic attack?"</li>
<li>"What if I have to heal my trauma first before I can live my passions?"</li>
<li>"What if I'm losing my mind?"</li>
<li>"Why am I like this?"</li>
<li>"What if these thoughts mean I'm a bad person?"</li>
<li>"What if I never feel normal again?"</li>
</ul>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Because you take them seriously, you give your brain the signal that you're engaging with them.</p>`
);

// ============================================================
// CHANGE 2: Section header "Get support..."
// ============================================================
applyReplace(
  'Section header: "Get support with my online workshop and community"',
  `Get support so the brain stops pulling you back into the battleground`,
  `Get support with my online workshop and community`
);

// ============================================================
// CHANGE 3: Replace the entire bloated section between header and the "What you get inside" h3
// New content uses Star's dictation + 4 workshop steps
// ============================================================
const oldSupportSection = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You need support to stay on track when the old patterns, the old algorithm, continue to try to pull you in.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">That's why I'm running an online workshop. <strong>Saturday, August 15.</strong> Where we go deep into changing your brain's algorithm together.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop happens inside the community I'm launching July 1st. And inside the community, you also get my weekly Staying On Track calls. Helping you with your problems and challenges. Helping you stay on track in the direction of the life you actually want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is where we go deep. The weekly calls keep you on track week to week. The community is the room where you do both.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The Los Angeles workshop was so powerful because everyone in the room was going in the same direction. Wanting to grow.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You have an environment of people who want to go in the same direction. You might not have that environment at home or wherever you are.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You can have that. It keeps you on track.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">When it keeps you on track, it keeps you going in the same direction. Away from the battlefield.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You show your brain you care about something else.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And you change your brain's algorithm.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You do that moment to moment. And it's a lot easier when you have people around you doing it too.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">So I'm launching this community July 1st.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You're on my list. You get the invitation as one of the first people.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">This will be a community of good-hearted, talented people who know what it means to be supportive, respectful, encouraging human beings.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">I will be very protective of the culture. We are creating an amazing atmosphere that supports everyone.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">Like a garden that is watered well and given sunshine. It nurtures, and we nurture the garden.</p>`;

const newSupportSection = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You probably can tell that changing the algorithm can be challenging when the brain always tries to get you back into the old patterns.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">To stay on track it's important to have a support system. I created this support system in the form of a community and online workshops.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">I'm launching this community for the first time on July 1st.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Where you get weekly live calls with me to stay on track. And as a member, you get a discount on the <strong>From Anxiety to Confidence Workshop</strong> that so many of you have been waiting for.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> Where we go deep in transformation.</p>

<p style="margin:0 0 14px;font-size:16px;line-height:1.65;font-weight:600;">Here's what we cover in the workshop:</p>

<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> The 3-step system that breaks the algorithm. Tools to interrupt the anxiety loop the next time it tries to run you.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
</ol>`;

applyReplace(
  'Replace bloated "Get support" section with tight version + 4 workshop steps',
  oldSupportSection,
  newSupportSection
);

// ============================================================
// CHANGE 4: Update bullets — workshop name, EFT written out, drop Wins of the Day, add Audacity
// ============================================================
const oldBullets = `<ul style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.85;">
<li><strong>My online workshop on Saturday, August 15 — included.</strong> Where we go deep into changing your brain's algorithm.</li>
<li><strong>Weekly Staying On Track calls with me.</strong> Helping you with your problems and challenges. Helping you stay on track in the direction of the life you want. First call July 1st.</li>
<li>A community of like-minded and good-hearted people who want to grow</li>
<li>Meditation and EFT we do together</li>
<li>Direct access to me in the feed</li>
<li>Tools like the Wins of the Day, to celebrate your actions instead of trying to fix your emotions and thoughts</li>
</ul>`;

const newBullets = `<ul style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.85;">
<li><strong>Weekly live calls with me to stay on track.</strong> Sometimes meditation and Emotional Freedom Technique together. First call <strong>July 1st</strong>.</li>
<li><strong>Member discount on the From Anxiety to Confidence Workshop</strong> on Saturday, August 15.</li>
<li><strong>Be a tester for Audacity</strong>, my upcoming app with tools to help you live a lighter life, let go of old patterns, and take daily action toward the life you want. Help me make it work for you.</li>
<li>A community of like-minded and good-hearted people who want to grow.</li>
<li>Getting support in the feed.</li>
<li>Q&A in the feed. I answer with Loom videos.</li>
</ul>`;

applyReplace('Update bullets (workshop name, EFT spelled out, Audacity added, Wins of the Day dropped)', oldBullets, newBullets);

// ============================================================
// CHANGE 5: Pricing line — drop "$97" mention + add guarantee
// ============================================================
const oldPricingBlock = `<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month, locked. Even when it goes to $97.</p>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">7-day free trial. Cancel in one click.</p>`;

const newPricingBlock = `<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month.</p>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">7-day free trial.</p>`;

applyReplace('Pricing line: drop $97, add 30-day dual guarantee', oldPricingBlock, newPricingBlock);

// ============================================================
// CHANGE 6: CTA button URL — point to Skool redirect
// ============================================================
applyReplace(
  'CTA URL: point to /community redirect (-> Skool)',
  `https://starjessetaylor.com/whats-next?source=mailchimp_burn`,
  `https://starjessetaylor.com/community?source=mailchimp_workshop_email`
);

// Also update the P.S. that referenced "the link above is also how you come over to my new email home"
const oldPS = `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. If you want to keep hearing from me, the link above is also how you come over to my new email home. Same link, same place.</p>`;
const newPS = `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. See you inside on July 1st.</p>`;
applyReplace('Update P.S. footer (plain, no salesy pause line)', oldPS, newPS);

// Replace the close: drop the pause/excitement duplicate, use Star's verbatim
applyReplace(
  'Body close: "I\'m excited to see you in the community."',
  `<p style="margin:36px 0 0;font-size:15px;line-height:1.65;color:#444;">Your life's been on pause long enough.</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:#444;">I want to help you live a life of excitement.</p>`,
  `<p style="margin:36px 0 0;font-size:15px;line-height:1.65;color:#444;">I'm excited to see you in the community.</p>`
);

// ============================================================
// POST-PROCESS: bold every July 1st instance globally
// ============================================================
const beforeBold = (html.match(/July 1st/g) || []).length;
html = html.replace(/<strong>July 1st<\/strong>/g, 'TEMP_BOLDED_JULY'); // protect already bolded
html = html.replace(/July 1st/g, '<strong>July 1st</strong>');
html = html.replace(/TEMP_BOLDED_JULY/g, '<strong>July 1st</strong>');
const afterBold = (html.match(/<strong>July 1st<\/strong>/g) || []).length;
console.log(`✓ Bolded ${afterBold} July 1st instances (was ${beforeBold} total)`);

// ============================================================
// SAVE LOCAL PREVIEW + show summary
// ============================================================
fs.writeFileSync(PREVIEW_FILE, html);
console.log();
console.log('============================================================');
console.log(`✓ ALL CHANGES APPLIED LOCALLY`);
console.log(`✓ Preview saved to: ${PREVIEW_FILE}`);
console.log(`✓ HTML length: ${html.length} chars`);
console.log('============================================================');
console.log();
console.log('NOT pushed to MailChimp yet.');
console.log('After Star approves the preview, run:');
console.log('  node scripts/push-workshop-email-v14.mjs');
