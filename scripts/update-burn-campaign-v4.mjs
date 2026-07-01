#!/usr/bin/env node
/**
 * Update burn campaign v4 — Questions section rewrite:
 * - "Los Angeles workshop" not "LA workshop" + "the participants" not "people"
 * - 9 bad questions (added 3: "What if this fear never goes away?", "What if I get another panic attack?", "What if these thoughts never go away?")
 * - 10 good questions (added: "What do I care about?", "What would I do if I was already extremely confident?", "How would I act if I didn't have these problems?", "How would I act if I didn't have these emotions and thoughts?", removed: "What would I do if this wasn't here?")
 * - "behaviors and actions" not just "behaviors"
 * - "give you more of that" not "give you more of"
 * - "Your brain wants to answer the questions. So ask the questions that support you."
 * - "You see that you have totally different answers from when you asked before."
 */

import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const API_KEY = CONFIG.api_key;
const SERVER = CONFIG.server;
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';

const AUTH = `apikey:${API_KEY}`;
const AUTH_HEADER = `Basic ${Buffer.from(AUTH).toString('base64')}`;

async function mc(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  if (!res.ok) { console.error(`MailChimp API error ${res.status}:`, text); throw new Error(`API call failed: ${path}`); }
  return text ? JSON.parse(text) : {};
}

console.log('Fetching current campaign content...');
const current = await mc(`/campaigns/${CAMPAIGN_ID}/content`);

// Rebuild the Questions section
const OLD_QUESTIONS_SECTION = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">How do you leave the battlefield?</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You do it with the power of questions. The power of questions is something I taught people at the LA workshop.</p>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions like:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>How do I fix this?</li>
<li>What's wrong with me?</li>
<li>Am I going to go crazy?</li>
<li>Why do I have these problems?</li>
<li>Why does this keep happening?</li>
<li>What if it gets worse?</li>
</ul>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself different questions:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>What do I want to spend my time on?</li>
<li>What do I want to grow?</li>
<li>What is useful?</li>
<li>What are useful actions?</li>
<li>What is my excitement?</li>
<li>What would I do if this wasn't here?</li>
<li>Who do I want to be in this moment?</li>
</ul>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">And then you answer those questions in behaviors. Because <strong>the brain's language is behavior</strong>.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer questions. Once you have the answer, you navigate your life in that direction.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-style:italic;background:#f6f4ef;padding:18px 20px;border-left:3px solid #1c1c1c;">Ask yourself those questions right now while you're reading this email. You'll see you have a totally different answer.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">It's a whole different paradigm than asking how to fix things.</p>`;

const NEW_QUESTIONS_SECTION = `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">How do you leave the battlefield?</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">You do it with the power of questions. The power of questions is something I taught the participants at the Los Angeles workshop.</p>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">Instead of asking yourself questions like:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>How do I fix this?</li>
<li>What's wrong with me?</li>
<li>Am I going to go crazy?</li>
<li>What if this fear never goes away?</li>
<li>Why do I have these problems?</li>
<li>Why does this keep happening?</li>
<li>What if it gets worse?</li>
<li>What if I get another panic attack?</li>
<li>What if these thoughts never go away?</li>
</ul>

<p style="margin:0 0 12px;font-size:16px;line-height:1.65;">You ask yourself different questions:</p>
<ul style="margin:0 0 22px;padding:0 0 0 20px;font-size:16px;line-height:1.75;">
<li>What do I want to spend my time on?</li>
<li>What do I want to grow?</li>
<li>What is useful?</li>
<li>What are useful actions?</li>
<li>What is my excitement?</li>
<li>What do I care about?</li>
<li>What would I do if I was already extremely confident?</li>
<li>Who do I want to be in this moment?</li>
<li>How would I act if I didn't have these problems?</li>
<li>How would I act if I didn't have these emotions and thoughts?</li>
</ul>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Then you answer those questions in behaviors and actions. Because <strong>the brain's language is behavior</strong>.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Whatever you spend your time and energy on, the brain will give you more of that.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;">Your brain wants to answer the questions. So ask the questions that support you. Once you have the answer, you navigate your life in that direction.</p>

<p style="margin:0 0 18px;font-size:16px;line-height:1.65;font-style:italic;background:#f6f4ef;padding:18px 20px;border-left:3px solid #1c1c1c;">Ask yourself those questions right now while you're reading this email. You see that you have totally different answers from when you asked before.</p>

<p style="margin:0 0 30px;font-size:16px;line-height:1.65;">It's a whole different paradigm than asking how to fix things.</p>`;

let updatedHtml = current.html.replace(OLD_QUESTIONS_SECTION, NEW_QUESTIONS_SECTION);

if (updatedHtml === current.html) {
  console.error('ERROR: replacement did NOT match. Old section not found in current HTML.');
  process.exit(1);
}

console.log('Updating campaign with v4 changes...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({ html: updatedHtml, plain_text: current.plain_text }),
});

console.log('✓ Updated. No test sent yet — Star still dictating.');
