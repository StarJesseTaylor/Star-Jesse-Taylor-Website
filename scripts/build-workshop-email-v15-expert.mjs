#!/usr/bin/env node
/**
 * v15 — Apply all 7 expert recommendations from the Hormozi/Brunson/Cabler workflow
 * + Star's standing asks (hot seat as step 5, "inside the community", Audacity benefit).
 *
 * Source: workshop-email-v14-PREVIEW.html (NOT touched)
 * Output: workshop-email-v15-EXPERT.html (new file, side-by-side comparison)
 *
 * Changes (in HTML order):
 *  - Add preheader hidden div at top of body
 *  - Add symptom-list line after brain-language teaching paragraph
 *  - Voice scrub workshop section (3-step system, go deep, newfound, authentic you, double stay on track)
 *  - Add hot seat as 5th workshop step
 *  - Add workshop math line + founding-member frame above price
 *  - Change "What you get inside" -> "What you get inside the community"
 *  - Update Audacity bullet with daily-action benefit
 *  - Tighten guarantee + remove 7-day/30-day overlap
 *  - Add consequence-of-pain beat before CTA
 *  - Rewrite P.S. with link
 */

import fs from 'fs';

const SOURCE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v14-PREVIEW.html';
const OUTPUT = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v15-EXPERT.html';

let html = fs.readFileSync(SOURCE, 'utf8');

function apply(label, oldText, newText) {
  if (!html.includes(oldText)) {
    console.error(`✗ FAILED to find: ${label}`);
    console.error(`  Looking for: ${oldText.slice(0, 120)}...`);
    process.exit(1);
  }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// ============================================================
// CHANGE 1: Add preheader hidden div at top of body
// ============================================================
apply(
  'Add preheader hidden div',
  `<body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;-webkit-font-smoothing:antialiased;">`,
  `<body style="margin:0;padding:0;background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:#f6f4ef;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">The reason everyone else is flowing and you're fighting. The room opens July 1.</div>`
);

// ============================================================
// CHANGE 2: Add symptom-list line after brain-language teaching
// ============================================================
apply(
  'Add symptom list mid-email',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whether it shows up as anxiety, overthinking, procrastination, or intrusive thoughts, the mechanism is the same. You engaged it. The brain gave you more of it.</p>`
);

// ============================================================
// CHANGE 3: Voice scrub the workshop intro line
// ============================================================
apply(
  'Voice scrub: "go deep in transformation"',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> Where we go deep in transformation.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> We work the patterns live, together, the same way we did in LA.</p>`
);

// ============================================================
// CHANGE 4: Voice scrub workshop steps + add hot seat as step 5
// ============================================================
const oldSteps = `<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> The 3-step system that breaks the algorithm. Tools to interrupt the anxiety loop the next time it tries to run you.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
</ol>`;

const newSteps = `<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> Tools to interrupt the loop the next time the brain tries to run you back to the battlefield.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from you, not the inherited patterns. Anchors that give you stability in the new direction.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
<li style="margin-bottom:14px;"><strong>Live Hot Seat Coaching.</strong> Volunteers come up. I coach them personally on what's keeping them stuck. The rest of the room learns by watching real work happen in real time.</li>
</ol>`;

apply('Voice scrub workshop steps + add Hot Seat as step 5', oldSteps, newSteps);

// ============================================================
// CHANGE 5: "What you get inside" -> "What you get inside the community"
// ============================================================
apply(
  '"What you get inside" -> "inside the community" + add transition paragraph',
  `<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside:</h3>`,
  `<p style="margin:24px 0 18px;font-size:16px;line-height:1.65;">Now here's what you get every month inside the community when the doors open July 1st:</p>

<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside the community:</h3>`
);

// Note: the v14 heading already said "What you get inside:" originally. The apply above will FAIL if the heading actually says "What you get inside:" not "inside the community:"
// Let me use a less specific approach below as fallback IF the above fails.

// ============================================================
// CHANGE 6: Update Audacity bullet with daily-action benefit
// ============================================================
apply(
  'Audacity bullet: add daily-action benefit',
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app, and help me make it work for you.</li>`,
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app that helps you take daily action toward the life you want, even when your brain tries to pull you back. Help me make it work for you.</li>`
);

// ============================================================
// CHANGE 7: Workshop math + founding-member frame above price
// ============================================================
apply(
  'Add workshop math + founding-member frame above price',
  `<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#1c1c1c;">If you're coming to the August workshop, joining today saves you $100 on it. That covers your first two months of community. The math works in your favor either way.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#1c1c1c;">The first live call is July 1. Founding members are in the room from day one. After that, you're catching up to a conversation that already started.</p>

<p style="margin:0 0 14px;font-size:17px;line-height:1.65;color:#1c1c1c;font-weight:600;">$49 a month.</p>`
);

// ============================================================
// CHANGE 8: Tighten guarantee, remove overlap with 7-day trial
// ============================================================
apply(
  'Tighten guarantee + remove 7-day/30-day overlap',
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#444;">7-day free trial. Cancel in one click.</p>

<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;"><strong>30-day money-back guarantee.</strong> If you don't feel lighter and take action on what you've been avoiding, I'll refund you.</p>`,
  `<p style="margin:0 0 30px;font-size:15px;line-height:1.65;color:#444;">Try it free for 7 days. If a month in you don't feel it was worth $49, email me and I refund you. One click cancel, no form, no friction.</p>`
);

// ============================================================
// CHANGE 9: Consequence-of-pain beat before CTA
// ============================================================
apply(
  'Add consequence-of-pain beat before CTA',
  `<p style="margin:0 0 24px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">Ready to come in?</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.5;color:#1c1c1c;">Another month on the battlefield is another month of the safe job, the unspoken thing, the room you didn't walk into.</p>

<p style="margin:0 0 24px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">Come in instead.</p>`
);

// ============================================================
// CHANGE 10: Rewrite P.S. with link
// ============================================================
apply(
  'Rewrite P.S. with embedded link',
  `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. See you inside on July 1st. Your life's been on pause long enough.</p>`,
  `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. The brain that's been keeping you on the battlefield is the same brain reading this P.S. trying to talk you out of it. That's the test. First call is July 1, 7-day free trial, one-click cancel. <a href="https://starjessetaylor.com/community?source=mailchimp_workshop_email_ps" style="color:#1c1c1c;font-weight:700;">Come in — $49/m</a></p>`
);

// ============================================================
// SAVE OUTPUT
// ============================================================
fs.writeFileSync(OUTPUT, html);
console.log();
console.log('============================================================');
console.log(`✓ EXPERT VERSION (v15) SAVED`);
console.log(`✓ Output: ${OUTPUT}`);
console.log(`✓ HTML length: ${html.length} chars`);
console.log(`✓ Original v14 preview is UNTOUCHED at: ${SOURCE}`);
console.log('============================================================');
