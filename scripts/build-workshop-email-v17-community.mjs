#!/usr/bin/env node
/**
 * v17 — COMMUNITY-LED version for MailChimp send to 2009 engaged + AC skool:waitlist + untagged AC.
 *
 * Takes v16 (workshop-led) as base and STRIPS workshop content:
 *  - Removes the workshop intro paragraph
 *  - Removes the 5 workshop steps (Expose / Break / Build / Practice / Hot Seat)
 *  - Replaces with ONE-line callout: "And as a member you save $100 on the August 15 workshop when you're ready."
 *  - Community bullets become the hero offer
 *  - Everything else (teaching, fire, Justina, pricing, CTA) untouched
 *
 * Source: workshop-email-v16-FINAL.html (NOT modified)
 * Output: workshop-email-v17-COMMUNITY.html
 */

import fs from 'fs';

const SOURCE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-FINAL.html';
const OUTPUT = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-COMMUNITY.html';

let html = fs.readFileSync(SOURCE, 'utf8');

function apply(label, oldText, newText) {
  if (!html.includes(oldText)) {
    console.error(`✗ FAILED to find: ${label}`);
    console.error(`  Looking for: ${oldText.slice(0, 150)}...`);
    process.exit(1);
  }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// Strip the workshop intro paragraph + 5 steps + "Here's what we cover" header
const workshopBlock = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> We work the patterns live, together, the same way we did in LA. So the brain doesn't pull you back and you stay on track.</p>

<p style="margin:0 0 14px;font-size:16px;line-height:1.65;font-weight:600;">Here's what we cover in the workshop:</p>

<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> Tools to interrupt the loop the next time the brain tries to run you back to the battlefield.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
<li style="margin-bottom:14px;"><strong>Live Hot Seat Coaching with me.</strong> Volunteers come up. I coach them personally on what's keeping them stuck. The rest of the room learns by watching real work happen in real time.</li>
</ol>`;

const replacementCallout = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And as a member you get a discount on the <strong>From Anxiety to Confidence Workshop</strong> on August 15 when you're ready to go deeper. The community comes first — the workshop is there when you want it.</p>`;

apply('Strip workshop intro + 5 steps, replace with one-line callout', workshopBlock, replacementCallout);

// Also update the headline to drop "online workshop and"
apply(
  'Section header: drop "online workshop and"',
  `Get support with my online workshop and community`,
  `Get support inside my community`
);

// Update the launch sentence to drop workshop reference
apply(
  'Launch sentence: focus on community only',
  `Where you get weekly live calls with me to stay on track. And as a member, you get $100 off the <strong>From Anxiety to Confidence Workshop</strong> that so many of you have been waiting for.`,
  `Where you get weekly live calls with me to stay on track, a like-minded community keeping you accountable, and direct access to me in the feed.`
);

// Update bullet for workshop to mention it's optional/upgrade
apply(
  'Update workshop bullet to be lower-key in community context',
  `<li><strong>Member discount on the From Anxiety to Confidence Workshop</strong> on Saturday, August 15.</li>`,
  `<li><strong>Member discount on the optional From Anxiety to Confidence Workshop</strong> on August 15 — for when you're ready to go deeper.</li>`
);

// Bold every "July 1st" instance
html = html.replace(/July 1st/g, '<strong>July 1st</strong>');
// Clean up double-bold if any: <strong><strong>July 1st</strong></strong> → <strong>July 1st</strong>
html = html.replace(/<strong><strong>July 1st<\/strong><\/strong>/g, '<strong>July 1st</strong>');
console.log('✓ Bolded all July 1st instances');

fs.writeFileSync(OUTPUT, html);
console.log();
console.log('============================================================');
console.log(`✓ v17 COMMUNITY-LED SAVED`);
console.log(`✓ Output: ${OUTPUT}`);
console.log(`✓ HTML length: ${html.length} chars`);
console.log(`✓ Workshop-led v16 UNTOUCHED at: ${SOURCE}`);
console.log('============================================================');
