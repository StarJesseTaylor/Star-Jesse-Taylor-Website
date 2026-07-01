#!/usr/bin/env node
import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const API_URL = CONFIG.apiUrl;
const API_KEY = CONFIG.apiKey;
const HEADERS = { 'Api-Token': API_KEY, Accept: 'application/json' };

async function ac(path) {
  const res = await fetch(`${API_URL}/api/3${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const TARGETS = [
  // workshop bucket
  'interest:online-workshop',
  'path:online-event',
  'event:waitlist',
  'Virtual Event Interested',
  'Zoom RSVP',
  // community bucket
  'interest:skool-community',
  'path:skool-public',
  'skool:waitlist',
  // cohort bucket
  'interest:cohort',
  'path:cohort',
  'cohort:waitlist',
  // both
  'interest:both',
  // general
  'source:whats-next',
  'source:mailchimp-migration',
];

for (const tagName of TARGETS) {
  try {
    const r = await ac(`/tags?search=${encodeURIComponent(tagName)}&limit=20`);
    const exact = (r.tags || []).find(t => t.tag === tagName);
    if (exact) {
      console.log(`  ${tagName.padEnd(35)} → ${exact.subscriber_count || 0} contacts (tag id ${exact.id})`);
    } else {
      console.log(`  ${tagName.padEnd(35)} → TAG NOT FOUND`);
    }
  } catch (e) {
    console.log(`  ${tagName.padEnd(35)} → error: ${e.message}`);
  }
}
