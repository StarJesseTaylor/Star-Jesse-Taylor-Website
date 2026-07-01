#!/usr/bin/env node
/**
 * Create the burn email as a DRAFT campaign in ActiveCampaign.
 * Same body as MailChimp version but with AC-appropriate P.S. (no migration framing).
 * Target: Master Contact List (id 3), ~314 active subscribers.
 *
 * Does NOT send. Star reviews + sends manually OR via a separate "send" script.
 */

import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const API_URL = CONFIG.apiUrl.replace(/\/$/, '');
const API_KEY = CONFIG.apiKey;
const LIST_ID = 3; // Master Contact List

async function ac(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Api-Token': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`AC API error ${res.status} on ${path}:`, text);
    throw new Error(`API call failed: ${path}`);
  }
  return text ? JSON.parse(text) : {};
}

// Fetch the current MailChimp HTML to mirror, then swap P.S.
async function getMailchimpHtml() {
  const mcConfig = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
  const auth = `Basic ${Buffer.from(`apikey:${mcConfig.api_key}`).toString('base64')}`;
  const res = await fetch(`https://${mcConfig.server}.api.mailchimp.com/3.0/campaigns/434148f526/content`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error(`Could not fetch MC content: ${res.status}`);
  return await res.json();
}

console.log('Fetching MailChimp campaign HTML to mirror...');
const mcContent = await getMailchimpHtml();

// Swap the P.S. for AC version
const mcPs = `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. If you want to keep hearing from me, the link above is also how you come over to my new email home. Same link, same place.</p>`;

const acPs = `<p style="margin:0;font-size:13px;line-height:1.65;color:#777;">P.S. You'll keep hearing from me here. The link above gets you inside the community.</p>`;

let html = mcContent.html.replace(mcPs, acPs);

if (html === mcContent.html) {
  console.warn('WARNING: Could not find MC P.S. to swap. Sending with MC P.S. as-is.');
}

// AC merge tag for first name (in case we add personalization later)
html = html.replace(/\*\|FNAME\|\*/g, '%FIRSTNAME%');

const plainText = `You keep waiting to feel ready before you live.

[Full teaching email — body matches HTML version]

Come in: https://starjessetaylor.com/whats-next?source=ac_burn

— Star

P.S. You'll keep hearing from me here. The link above gets you inside the community.`;

// AC requires creating a "message" first
// AC API: POST /api/3/messages with email body details
console.log('Creating AC message...');
const messagePayload = {
  message: {
    fromemail: 'star@starjessetaylor.com',
    fromname: 'Star Jesse Taylor',
    reply2: 'star@starjessetaylor.com',
    subject: 'You keep waiting to feel ready before you live',
    preheader: "Why you can't stop fighting your brain, and what to do instead.",
    html: html,
    text: plainText,
    format: 'mime',
    htmlfetch: 0,
    textfetch: 0,
  },
};

const messageRes = await ac('/api/3/messages', {
  method: 'POST',
  body: JSON.stringify(messagePayload),
});
const messageId = messageRes.message?.id;
console.log(`  Message created. ID: ${messageId}`);

// Now create the campaign that references this message
console.log('Creating AC campaign (draft)...');
const campaignPayload = {
  campaign: {
    type: 'single',
    name: 'Burn email — Power of Questions (AC v1)',
    sdate: null, // null = draft, not scheduled
    status: 0, // 0 = draft
    public: 1,
    mail_transfer: 0,
    tracklinks: 'all',
    track_reads: 1,
    track_links: 1,
    p: { 3: 1 }, // list ID 3 (Master Contact List)
    m: { [messageId]: 100 }, // 100% of recipients get this message
  },
};

const campaignRes = await ac('/api/3/campaigns', {
  method: 'POST',
  body: JSON.stringify(campaignPayload),
});

const campaignId = campaignRes.campaign?.id;
console.log(`\n✓ AC draft campaign created. ID: ${campaignId}`);
console.log('  Status: DRAFT (not sent, not scheduled)');
console.log(`\nView in AC: https://starjessetaylor92181.activehosted.com/campaign/${campaignId}/edit`);
console.log(`\nTo send later: ./send-ac-campaign.mjs ${campaignId}`);
