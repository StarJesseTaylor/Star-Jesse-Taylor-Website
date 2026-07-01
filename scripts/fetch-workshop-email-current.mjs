#!/usr/bin/env node
/**
 * Pulls the current MailChimp campaign content + settings + sending status.
 * Read-only — does not modify the campaign.
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/mailchimp.json', 'utf8'));
const API_KEY = CONFIG.api_key;
const SERVER = CONFIG.server;
const BASE = `https://${SERVER}.api.mailchimp.com/3.0`;
const CAMPAIGN_ID = '434148f526';

const AUTH_HEADER = `Basic ${Buffer.from(`apikey:${API_KEY}`).toString('base64')}`;

async function mc(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH_HEADER } });
  const text = await res.text();
  if (!res.ok) { console.error(`MailChimp API error ${res.status} on ${path}:`, text.slice(0, 300)); throw new Error('API error'); }
  return text ? JSON.parse(text) : {};
}

const campaign = await mc(`/campaigns/${CAMPAIGN_ID}`);
const content = await mc(`/campaigns/${CAMPAIGN_ID}/content`);

console.log('=== CAMPAIGN INFO ===');
console.log('Status:', campaign.status);
console.log('Subject:', campaign.settings?.subject_line);
console.log('Preview:', campaign.settings?.preview_text);
console.log('From name:', campaign.settings?.from_name);
console.log('Reply to:', campaign.settings?.reply_to);
console.log('Audience:', campaign.recipients?.list_id, '(' + (campaign.recipients?.recipient_count || '?') + ' recipients)');
console.log('Send time:', campaign.send_time || '(not scheduled)');
console.log();

// Save full HTML to disk for inspection
const outFile = 'C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-current.html';
fs.writeFileSync(outFile, content.html || '');
console.log(`HTML saved to: ${outFile}`);
console.log(`HTML length: ${(content.html || '').length} chars`);
console.log();

// Print plain-text version
console.log('=== PLAIN TEXT VERSION ===');
console.log((content.plain_text || '(no plain text)').slice(0, 3000));
