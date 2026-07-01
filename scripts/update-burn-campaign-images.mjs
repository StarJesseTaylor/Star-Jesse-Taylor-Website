#!/usr/bin/env node
/**
 * Update the existing burn campaign with cache-busted image URLs.
 * Then re-send test to Star.
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
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`MailChimp API error ${res.status}:`, text);
    throw new Error(`API call failed: ${path}`);
  }
  return text ? JSON.parse(text) : {};
}

console.log('Fetching current campaign content...');
const current = await mc(`/campaigns/${CAMPAIGN_ID}/content`);

// Cache-bust the image URLs to force email clients to fetch the new (correctly-oriented) versions
const updatedHtml = current.html
  .replace(/image15\.jpg/g, 'image15.jpg?v=2')
  .replace(/image20\.jpg/g, 'image20.jpg?v=2')
  .replace(/image30\.jpg/g, 'image30.jpg?v=2');

console.log('Updating campaign with cache-busted URLs...');
await mc(`/campaigns/${CAMPAIGN_ID}/content`, {
  method: 'PUT',
  body: JSON.stringify({
    html: updatedHtml,
    plain_text: current.plain_text,
  }),
});

console.log('Re-sending test...');
await mc(`/campaigns/${CAMPAIGN_ID}/actions/test`, {
  method: 'POST',
  body: JSON.stringify({
    test_emails: ['starjessetaylor@gmail.com'],
    send_type: 'html',
  }),
});

console.log('\n✓ Updated. New test sent to starjessetaylor@gmail.com');
console.log('Check inbox in 1-2 minutes — photos should be right-side up now.');
