#!/usr/bin/env node
/**
 * Pull ActiveCampaign lists, tags, and contact counts per tag.
 * Read-only. No changes made.
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const API_URL = CONFIG.apiUrl || CONFIG.api_url;
const API_KEY = CONFIG.apiKey || CONFIG.api_key;

const HEADERS = { 'Api-Token': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };

async function ac(path) {
  const res = await fetch(`${API_URL}/api/3${path}`, { headers: HEADERS });
  const text = await res.text();
  if (!res.ok) { console.error(`AC API error ${res.status} on ${path}:`, text.slice(0, 300)); throw new Error('AC API error'); }
  return JSON.parse(text);
}

console.log('=== LISTS ===');
const lists = await ac('/lists?limit=100');
for (const l of (lists.lists || [])) {
  console.log(`  [${l.id}] ${l.name} — ${l.subscriber_count || '?'} active subscribers, total ${l.contact_count || '?'}`);
}
console.log();

console.log('=== TAGS (top 100 by usage) ===');
const tags = await ac('/tags?limit=100&orders[subscriber_count]=DESC');
let totalTagged = 0;
for (const t of (tags.tags || [])) {
  const count = t.subscriber_count !== undefined ? t.subscriber_count : '?';
  totalTagged += parseInt(t.subscriber_count) || 0;
  console.log(`  [${t.id.padStart(4)}] ${count.toString().padStart(5)} — ${t.tag}${t.description ? ' :: ' + t.description.slice(0, 60) : ''}`);
}
console.log();
console.log(`Tags fetched: ${(tags.tags || []).length}`);
console.log(`Sum of tag-subscriber counts: ${totalTagged} (contacts can have multiple tags)`);
