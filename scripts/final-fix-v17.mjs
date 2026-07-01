#!/usr/bin/env node
/**
 * Apply ALL Star's final corrections to v17 directly + push test.
 *
 * Critical fixes:
 *  - REAL Skool URL: https://www.skool.com/star-jesse-taylor-3703/about
 *  - Move button up — directly after "$49 a month" line, NOT under picture
 *  - Kill "Ready to come in?" + "Come in now → $49 a month" sales language
 *  - Remove "Your life's been on pause long enough"
 *  - New close: "I'm excited to see you in the community"
 *  - New guarantee: Star's verbatim "I'm so confident..."
 *  - Bold every July 1st
 *  - Expanded Audacity bullet
 *  - Member discount (not $100)
 *  - Merge meditation/EFT into weekly calls bullet
 *  - Remove $100 from workshop callout
 */
import fs from 'fs';

const SOURCE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-COMMUNITY.html';
const OUTPUT = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html';

const SKOOL_URL = 'https://www.skool.com/star-jesse-taylor-3703/about';

let html = fs.readFileSync(SOURCE, 'utf8');

function apply(label, oldText, newText) {
  if (html.includes(newText) && !html.includes(oldText)) {
    console.log(`= ${label} (already applied)`);
    return;
  }
  if (!html.includes(oldText)) {
    console.error(`✗ FAILED: ${label}`);
    console.error(`  needle: ${oldText.slice(0,140)}`);
    process.exit(1);
  }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// 1. Replace all CTA URLs with the real Skool URL
html = html.replace(/https:\/\/starjessetaylor\.com\/community\?source=mailchimp[^"]*/g, SKOOL_URL);
console.log(`✓ Replaced all /community URLs with ${SKOOL_URL}`);

// 2. Fix the "$100 off" mentions in v17 body
apply(
  'Workshop callout: $100 → discount',
  `And as a member you save $100 on the <strong>From Anxiety to Confidence Workshop</strong> on August 15`,
  `And as a member you get a discount on the <strong>From Anxiety to Confidence Workshop</strong> on August 15`
);

apply(
  'Workshop bullet: $100 → member discount',
  `$100 off the optional From Anxiety to Confidence Workshop`,
  `Member discount on the optional From Anxiety to Confidence Workshop`
);
apply(
  'Workshop bullet: trim "(member rate $297 vs $397 standalone)"',
  `on August 15 (member rate $297 vs. $397 standalone)`,
  `on August 15 — for when you're ready to go deeper`
);

// 3. Audacity bullet expansion
apply(
  'Audacity bullet: expand to lighter life + let go of old patterns',
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app that helps you take daily action toward the life you want, even when your brain tries to pull you back. Help me make it work for you.</li>`,
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app with tools to help you live a lighter life, let go of old patterns, and take daily action toward the life you want. Help me make it work for you.</li>`
);

// 4. Merge meditation/EFT into weekly calls bullet (drop separate bullet)
apply(
  'Weekly calls bullet: help WITH challenges (not coach through), recordings, any time zone',
  `<li><strong>Weekly live calls with me to stay on track.</strong> First call July 1st.</li>`,
  `<li><strong>Weekly live calls with me.</strong> Recordings included so you can re-watch anytime in any time zone. I help you with your challenges, stay on track, and take action toward a lighter, more fulfilling life. First call <strong>July 1st</strong>.</li>`
);

apply(
  'Replace meditation/EFT bullet with EFT classes only (simple)',
  `<li>Meditation and Emotional Freedom Technique we do together.</li>`,
  `<li><strong>Emotional Freedom Technique classes.</strong></li>`
);

// 5. Pricing block: new guarantee verbatim
apply(
  'Drop money guarantee paragraph entirely (7-day trial is enough, less try-hard)',
  `<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;"><strong>30-day money-back guarantee.</strong> If you don't feel lighter and take action on what you've been avoiding, I'll refund you.</p>`,
  ``
);

// Insert culture + early-shaping paragraph right after bullets, before price block
apply(
  'Add culture + early-shaping paragraph before price',
  `</ul>

<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month.</p>`,
  `</ul>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;"><strong>I'm very protective of the culture inside this community.</strong> I personally curate who's in this community, so when you're in, you can be sure of the people around you. This community is for good-hearted people who actually want to grow. Who want to use tools that work, not look for a quick fix. I was so impressed by the energy in the LA workshop room, supportive, real, all wanting to move forward. That's the energy I'm building here.</p>

<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month.</p>`
);

// 6. CRITICAL: restructure — move button OUT of the under-picture row, put RIGHT after pricing block
// Old: pricing block → close </td></tr> → picture row → button row (with "Ready to come in?" + button + close lines + P.S.)
// New: pricing block → button (here) → close </td></tr> → picture → close lines → P.S.
const oldButtonBlock = `<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/image25.jpg?v=11" alt="Star with workshop participants" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:36px 32px 36px 32px;" align="center">
<p style="margin:0 0 24px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">Ready to come in?</p>

<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="background:#1c1c1c;border-radius:6px;">
<a href="${SKOOL_URL}" style="display:inline-block;padding:18px 36px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Come in now → $49 a month</a>
</td></tr></table>

<p style="margin:36px 0 0;font-size:15px;line-height:1.65;color:#444;">Your life's been on pause long enough.</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:#444;">I want to help you live a life of excitement.</p>
<p style="margin:18px 0 0;font-size:15px;color:#1c1c1c;font-weight:700;">— Star</p>
</td></tr>`;

const newButtonBlock = `<tr><td style="padding:0 32px 30px 32px;" align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
<tr><td style="background:#1c1c1c;border-radius:6px;">
<a href="${SKOOL_URL}" style="display:inline-block;padding:18px 36px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">Join the community</a>
</td></tr></table>
</td></tr>

<tr><td style="padding:0;">
<img src="https://starjessetaylor.com/images/email/image25.jpg?v=11" alt="Star with workshop participants" width="600" style="display:block;width:100%;max-width:600px;height:auto;">
</td></tr>

<tr><td style="padding:30px 32px 36px 32px;" align="center">
<p style="margin:0;font-size:16px;line-height:1.65;color:#1c1c1c;">I'm excited to see you in the community.</p>
<p style="margin:18px 0 0;font-size:15px;color:#1c1c1c;font-weight:700;">— Star</p>
</td></tr>`;

apply('CRITICAL: move button up + kill sales language + restructure close', oldButtonBlock, newButtonBlock);

// 7. P.S. cleanup — drop the pause line, keep just dates
apply(
  'P.S.: drop pause line',
  `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. See you inside on July 1st. Your life's been on pause long enough.</p>`,
  `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. First call is <strong>July 1st</strong>.</p>`
);

// Star Jun 28 PM REVERSAL: keep workshop discount mention even in community email
// (Used to strip these — now keeping per Star's update)

// 7.7 Section header rewrite + pre-launch line above bullets
apply(
  'Section header: "The community and live calls with Star that keep you on track."',
  `Get support inside my community`,
  `The community and live calls with Star that keep you on track`
);

apply(
  'Add pre-launch line above "What you get inside" bullets (no duplicate header)',
  `<p style="margin:24px 0 18px;font-size:16px;line-height:1.65;">Now here's what you get every month inside the community when the doors open July 1st:</p>`,
  `<p style="margin:24px 0 18px;font-size:16px;line-height:1.65;"><strong>This is pre-launch.</strong> The community officially opens to the public on <strong>July 1st</strong>. You're getting this email because you're one of the first people I want in the room.</p>`
);

// Bump Hook C font for impact under the picture
apply(
  'Hook C: bigger font for impact under picture',
  `<p style="margin:0 0 22px;font-size:18px;line-height:1.6;font-weight:600;color:#1c1c1c;">Are you tired of watching everyone else live their life carefree while you fight what's in your head?</p>`,
  `<p style="margin:0 0 28px;font-size:28px;line-height:1.3;font-weight:700;color:#1c1c1c;letter-spacing:-0.01em;">Are you tired of watching everyone else live their life carefree while you fight what's in your head?</p>`
);

// 7.9 GLOBAL DASH-KILLING PASS — Star's locked rule: no dashes anywhere.
// Replace em-dashes (with surrounding spaces) → ". " or ", "
// Strategy: " — " becomes ". " if mid-sentence pivot, else ", "
// Simplest: replace " — " with ", " (comma fits most cases)
const beforeDashes = (html.match(/ — /g) || []).length;
// Where the dash starts a definition / list, prefer period:
html = html.replace(/the LA workshop room — /g, 'the LA workshop room, ');
html = html.replace(/I screen who comes in myself — /g, 'I screen who comes in myself, ');
// Catchall for any other em-dashes:
html = html.replace(/ — /g, ', ');
// Also kill any en-dash (–) and double-hyphen (--) just in case
html = html.replace(/ – /g, ', ');
html = html.replace(/ -- /g, ', ');
const afterDashes = (html.match(/ — /g) || []).length;
console.log(`✓ Removed ${beforeDashes - afterDashes} em-dashes (${beforeDashes} found → ${afterDashes} remaining)`);

// 8. Global bold-pass for any remaining unbolded July 1st (the bold-protect approach)
const beforeJ = (html.match(/July 1st/g) || []).length;
html = html.replace(/<strong>July 1st<\/strong>/g, 'XXTEMPBOLDXX');
html = html.replace(/July 1st/g, '<strong>July 1st</strong>');
html = html.replace(/XXTEMPBOLDXX/g, '<strong>July 1st</strong>');
const boldJ = (html.match(/<strong>July 1st<\/strong>/g) || []).length;
console.log(`✓ Bolded ${boldJ} total July 1st instances`);

fs.writeFileSync(OUTPUT, html);
console.log(`\n✓ FINAL v17 saved: ${OUTPUT}`);
console.log(`✓ Length: ${html.length} chars`);
