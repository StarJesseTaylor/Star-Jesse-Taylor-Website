#!/usr/bin/env node
/**
 * Apply ALL of today's content changes directly to v17-FINAL.html
 * (Bypassing broken v14 chain.)
 */
import fs from 'fs';

const FILE = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html';
let html = fs.readFileSync(FILE, 'utf8');

function apply(label, oldText, newText) {
  if (html.includes(newText) && !html.includes(oldText)) { console.log(`= ${label} (already applied)`); return; }
  if (!html.includes(oldText)) { console.error(`✗ ${label}\n  needle: ${oldText.slice(0,140)}`); return; }
  html = html.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

// 1. Present tense + carefree-inner-dialogue example
apply('Body: present tense + carefree inner-dialogue',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">They haven't taken their thoughts and emotions as seriously as you do.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">They don't take their thoughts and emotions as seriously as you do. When intense thoughts or emotions come up, they say, "Oh what a weird thing. I guess it's one of those days. Whatever. Let's move forward with our valued actions as well as we can."</p>`);

// 2. "But you take them seriously" + catastrophizing list + new transition
apply('Catastrophizing list + new transition',
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

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Because you take them seriously, you give your brain the signal that you're engaging with them.</p>`);

// 3. Add "Then" to brain-gives-you-more-battlefield
apply('Add "Then" to brain-gives-you-more',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain gives you more of the battlefield.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Then the brain gives you more of the battlefield.</p>`);

// 4. Replace "brain created more excessive thoughts" with cleaner version
apply('Replace brain-created-more with attacking-you version',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The brain created more excessive thoughts and emotions that attacked you. And now the brain automatically gives them to you right when you wake up and at any random time during the day.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">In the beginning, you engaged with thoughts and emotions other people don't engage with. By engaging, you gave your brain the signal to give you those thoughts automatically. Now the brain gives you those thoughts right when you wake up and at random times during the day. It feels like the brain is attacking you.</p>`);

// 5. Reframe bad-questions intro
apply('Bad questions intro reframe',
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions like:</p>`,
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions that create more mental health problems:</p>`);

// 6. Reframe good-questions intro
apply('Good questions intro reframe',
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself different questions:</p>`,
  `<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself questions that show your brain that, instead of fixing emotions and thoughts, you care about living your life:</p>`);

// 7. Drop "brain's language is behavior"
apply('Drop brain language is behavior',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Then you answer those questions in behaviors and actions. Because <strong>the brain's language is behavior</strong>.</p>

`,
  ``);

// 8. Remove "Who do I want to be in this moment?"
apply('Remove "Who do I want to be"',
  `<li>Who do I want to be in this moment?</li>
`,
  ``);

// 9. Drop "Ask yourself those questions right now..." blockquote + paradigm
apply('Drop blockquote + paradigm line',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-style:italic;background:#f6f4ef;padding:18px 20px;border-left:3px solid #1c1c1c;">Ask yourself those questions right now while you're reading this email. You see that you have totally different answers from when you asked before.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">It's a whole different paradigm than asking how to fix things.</p>`,
  ``);

// 10. Replace post-questions block
apply('Replace post-questions block with engagement-tied content',
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The more you do those actions, the more they become normal. They become familiar to the brain. You become more confident in those situations. You become more confident living your life. The life that you want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer the questions. So ask the questions that support you. Once you have the answer, you navigate your life in that direction.</p>`,
  `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The answers you get to the healthy questions come in the form of behaviors and actions. Following those actions in the moment, when you feel resistance and think you have to fix emotions, shows your brain you want to create a new algorithm.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Even though those emotions are changing your level of engagement, remember the language of the brain is engagement. Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">The more you do those actions while spending time outside of your head, the more they become normal. They become familiar to your brain. You become more confident in those situations. You become more confident living your life. The life that you want to live.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain is a question-answering machine. Ask the questions that support you moving in a healthy direction. Once you have the answer, you navigate your life in that direction.</p>`);

// 11. Add support-transition line + change h2 (do BOTH in one shot)
apply('Support transition + new h2',
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">But your brain is trying to get you back onto the battleground</h2>`,
  `<p style="margin:0 0 30px;font-size:18px;line-height:1.5;font-weight:600;color:#1c1c1c;">If you need support to walk off the battlefield in the direction of the life that you want to live, keep reading.</p>

<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">How you actually stay off the battlefield</h2>`);

// 12. Replace entire fire section with expanded teaching + carefree payoff + garden community announcement
apply('Replace fire section entirely with new teaching + carefree + community announcement',
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

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;font-weight:600;">You get the chance to enter the community before July 1st because you're getting this email. You're one of the first I want in the room.</p>`);

// 13. Change "Direct access to me in the feed" → "Getting support in the feed" + add Q&A bullet
apply('Direct access → Getting support + add Q&A bullet',
  `<li>Direct access to me in the feed.</li>`,
  `<li>Getting support in the feed.</li>
<li>Q&A in the feed. I answer with Loom videos.</li>`);

// 14. KILL the now-redundant "community and live calls" intro paragraphs
// (Content has been absorbed into the new fire/garden/community announcement section above)
apply('Kill redundant community-and-live-calls intro paragraphs (duplicated content)',
  `<h2 style="margin:0 0 18px;font-size:20px;font-weight:700;color:#1c1c1c;">The community and live calls with Star that keep you on track</h2>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You probably can tell that changing the algorithm can be challenging when the brain always tries to get you back into the old patterns.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">To stay on track it's important to have a support system. I created this support system in the form of a community and online workshops.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-weight:600;">I'm launching this community for the first time on <strong>July 1st</strong>.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Where you get weekly live calls with me to stay on track, a like-minded community keeping you accountable, and direct access to me in the feed.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And as a member you get a discount on the <strong>From Anxiety to Confidence Workshop</strong> on August 15 when you're ready to go deeper. The community comes first, the workshop is there when you want it.</p>


</td></tr>

<tr><td style="padding:0 32px 18px 32px;">
<p style="margin:24px 0 18px;font-size:16px;line-height:1.65;"><strong>This is pre-launch.</strong> The community officially opens to the public on <strong>July 1st</strong>. You're getting this email because you're one of the first people I want in the room.</p>

<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside the community:</h3>`,
  `<h3 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#1c1c1c;">What you get inside the community:</h3>`);

// Save
fs.writeFileSync(FILE, html);
console.log(`\n✓ Saved: ${FILE} (${html.length} chars)`);
