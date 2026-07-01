#!/usr/bin/env node
/**
 * Try AC v1 legacy API for campaign creation (since v3 returns 405).
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const URL = CONFIG.apiUrl;
const KEY = CONFIG.apiKey;

// Test v1 API: GET campaign_list
console.log('=== v1: campaign_list ===');
const listRes = await fetch(`${URL}/admin/api.php?api_action=campaign_list&api_output=json&api_key=${KEY}`);
console.log(`  status: ${listRes.status}`);
const listText = await listRes.text();
console.log(`  body sample: ${listText.slice(0, 300)}`);

// Test v1 API: try message_add (precursor to campaign_create)
console.log('\n=== v1: message_add ===');
const msgPayload = new URLSearchParams({
  'fromname': 'Star Jesse Taylor',
  'fromemail': 'starjessetaylor@gmail.com',
  'reply2': 'starjessetaylor@gmail.com',
  'subject': 'Test message v16',
  'preheader': 'preview text',
  'charset': 'utf-8',
  'encoding': '7bit',
  'format': 'mime',
  'htmlconstructor': 'editor',
  'html': '<html><body>test</body></html>',
  'textconstructor': 'editor',
  'text': 'test',
});
const msgRes = await fetch(`${URL}/admin/api.php?api_action=message_add&api_output=json&api_key=${KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: msgPayload,
});
console.log(`  status: ${msgRes.status}`);
const msgText = await msgRes.text();
console.log(`  body: ${msgText.slice(0, 500)}`);
