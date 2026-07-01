#!/usr/bin/env node
/**
 * v16 workshop-led = v17 community-led + workshop content injected.
 * Anchored on the new "Skool, an amazing community app" line (v17 community announcement).
 */
import fs from 'fs';

const SOURCE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html';
const OUTPUT = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-LATEST.html';

let html = fs.readFileSync(SOURCE, 'utf8');

function apply(label, oldText, newText) {
  if (!html.includes(oldText)) { console.error(`✗ FAILED: ${label}\n needle: ${oldText.slice(0,150)}`); process.exit(1); }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// Inject workshop content AFTER the Skool description, BEFORE the pre-launch line
const anchor = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The community lives on Skool, an amazing community app where you'll find everything in one place.</p>`;

const workshopBlock = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The community lives on Skool, an amazing community app where you'll find everything in one place.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And as a member, you get a discount on the <strong>From Anxiety to Confidence Workshop</strong> that so many of you have been waiting for.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The workshop is the online version of the LA workshop. <strong>Saturday, August 15.</strong> We work the patterns live, together, the same way we did in LA. So the brain doesn't pull you back and you stay on track.</p>

<p style="margin:0 0 14px;font-size:16px;line-height:1.65;font-weight:600;">Here's what we cover in the workshop:</p>

<ol style="margin:0 0 26px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li style="margin-bottom:14px;"><strong>Expose the Patterns of Anxiety.</strong> Making the invisible visible. Naming the anxiety patterns running your life that you cannot see on your own.</li>
<li style="margin-bottom:14px;"><strong>Break the Anxiety Algorithm.</strong> Tools to interrupt the loop the next time the brain tries to run you back to the battlefield.</li>
<li style="margin-bottom:14px;"><strong>Build Confidence on a New Direction.</strong> Choices from the authentic you, not the inherited patterns. Anchors that give you newfound stability.</li>
<li style="margin-bottom:14px;"><strong>Practice Confidence in Your Day to Day Life.</strong> A personalized plan to carry the tools into your life. Knowledge doesn't change a life. Practice does.</li>
<li style="margin-bottom:14px;"><strong>Live Hot Seat Coaching with me.</strong> Volunteers come up. I coach them personally on what's keeping them stuck. The rest of the room learns by watching real work happen in real time.</li>
</ol>`;

apply('Inject workshop content after Skool line', anchor, workshopBlock);

// Add workshop member-discount bullet back to "What you get inside" list
const oldFirstBullet = `<li><strong>Weekly live calls with me.</strong> Recordings included so you can re-watch anytime in any time zone. I help you with your challenges, stay on track, and take action toward a lighter, more fulfilling life. First call <strong>July 1st</strong>.</li>`;

const newBulletsWithWorkshop = `<li><strong>Weekly live calls with me.</strong> Recordings included so you can re-watch anytime in any time zone. I help you with your challenges, stay on track, and take action toward a lighter, more fulfilling life. First call <strong>July 1st</strong>.</li>
<li><strong>Member discount on the From Anxiety to Confidence Workshop</strong> on Saturday, August 15.</li>`;

apply('Add workshop discount bullet to "What you get inside"', oldFirstBullet, newBulletsWithWorkshop);

// Change the subject/title in <title>
html = html.replace(/<title>[^<]*<\/title>/, '<title>Online workshop announcement</title>');

fs.writeFileSync(OUTPUT, html);
console.log(`\n✓ v16-LATEST saved: ${OUTPUT} (${html.length} chars)`);
