#!/usr/bin/env node
/**
 * v16 — Take v14 + apply ONLY the changes Star approved:
 *  1. Symptom list line (mid-email)
 *  2. Workshop step 2: "Tools to interrupt the loop the next time the brain tries to run you back to the battlefield"
 *  3. Workshop intro: "We work the patterns live, together, the same way we did in LA. So the brain doesn't pull you back and you stay on track."
 *  4. Hot seat as step 5
 *  5. Heading: "What you get inside the community:" + transition paragraph
 *  6. Audacity bullet with daily-action benefit
 *
 *  REJECTED from v15:
 *  - Preheader
 *  - Founding-member first-mover frame
 *  - Workshop math anchor
 *  - Consequence-of-pain beat before CTA
 *  - Rewritten P.S.
 *  - Tightened guarantee
 *  - "Newfound stability" / "authentic you" scrubs (left alone)
 *
 * Source: workshop-email-v14-PREVIEW.html (NOT touched)
 * Output: workshop-email-v16-FINAL.html
 */

import fs from 'fs';

const SOURCE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v14-PREVIEW.html';
const OUTPUT = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-FINAL.html';

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

// 1. Symptom list line
apply(
  'Add symptom list line mid-email',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whether it shows up as anxiety, overthinking, procrastination, or intrusive thoughts, the mechanism is the same. You engaged it. The brain gave you more of it.</p>`
);

// 2. Workshop intro voice scrub + "stay on track" closer
apply(
  'Workshop intro: "we work the patterns live, same way as LA"',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> Where we go deep in transformation.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> We work the patterns live, together, the same way we did in LA. So the brain doesn't pull you back and you stay on track.</p>`
);

// 3. Workshop steps: voice scrub step 2 + add hot seat as step 5
const oldSteps = `<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> The 3-step system that breaks the algorithm. Tools to interrupt the anxiety loop the next time it tries to run you.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
</ol>`;

const newSteps = `<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> Tools to interrupt the loop the next time the brain tries to run you back to the battlefield.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
<li style="margin-bottom:14px;"><strong>Live Hot Seat Coaching with me.</strong> Volunteers come up. I coach them personally on what's keeping them stuck. The rest of the room learns by watching real work happen in real time.</li>
</ol>`;

apply('Workshop steps: voice scrub step 2 + Hot Seat as step 5', oldSteps, newSteps);

// 4. "What you get inside" -> "inside the community" + transition paragraph
apply(
  '"What you get inside" -> "inside the community" + transition',
  `<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside:</h3>`,
  `<p style="margin:24px 0 18px;font-size:16px;line-height:1.65;">Now here's what you get every month inside the community when the doors open July 1st:</p>

<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside the community:</h3>`
);

// 5. Audacity bullet — daily action benefit
apply(
  'Audacity bullet: add daily-action benefit',
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app, and help me make it work for you.</li>`,
  `<li><strong>Be a tester for Audacity</strong>, my upcoming app that helps you take daily action toward the life you want, even when your brain tries to pull you back. Help me make it work for you.</li>`
);

fs.writeFileSync(OUTPUT, html);
console.log();
console.log('============================================================');
console.log(`✓ v16 FINAL SAVED`);
console.log(`✓ Output: ${OUTPUT}`);
console.log(`✓ HTML length: ${html.length} chars`);
console.log(`✓ Original v14 preview UNTOUCHED at: ${SOURCE}`);
console.log('============================================================');
