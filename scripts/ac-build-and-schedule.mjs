#!/usr/bin/env node
/**
 * AC v1 legacy API: build messages, segments, campaigns. Schedule for 9 AM Pacific Saturday June 28 2026.
 *
 *  Two sends:
 *    - "AC Community" — v17 HTML to non-workshop contacts (Master List minus workshop tags)
 *    - "AC Workshop" — v16 HTML to workshop-tagged contacts (Virtual Event Interested + event:waitlist + path:online-event + Zoom RSVP)
 *
 *  Master Contact List ID: 3
 *  Workshop tag IDs: 23 (Virtual Event Interested), 52 (event:waitlist), 50 (path:online-event), 35 (Zoom RSVP)
 *  Community tag ID: 141 (skool:waitlist)
 *
 *  Schedule: 2026-06-28 09:00:00 Pacific
 */
import fs from 'fs';

const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const URL = CONFIG.apiUrl;
const KEY = CONFIG.apiKey;
const AC_BASE = `${URL}/admin/api.php`;
const v3 = `${URL}/api/3`;
const v3headers = { 'Api-Token': KEY, 'Content-Type': 'application/json', Accept: 'application/json' };

const SUBJECT = 'Are you tired of constantly fighting with your brain?';
const PREHEADER = "Why you can't stop fighting your brain, and what to do instead.";
const FROM_NAME = 'Star Jesse Taylor';
const FROM_EMAIL = 'starjessetaylor@gmail.com';
const REPLY_TO = 'starjessetaylor@gmail.com';
const LIST_ID = 3;
const SDATE = '2026-06-28 09:00:00'; // AC will interpret in account's timezone (LA)

const HTML_COMMUNITY = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');
const HTML_WORKSHOP = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-LATEST.html', 'utf8');

const WORKSHOP_TAG_IDS = [23, 52, 50, 35];

async function v1(action, params) {
  const body = new URLSearchParams({
    api_action: action,
    api_output: 'json',
    api_key: KEY,
    ...params,
  });
  const res = await fetch(AC_BASE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { console.error(`Non-JSON response: ${text.slice(0, 300)}`); throw new Error('parse fail'); }
  if (json.result_code === 0) {
    console.error(`  ✗ ${action}: ${json.result_message}`);
    throw new Error(json.result_message);
  }
  return json;
}

// ============================================================
// STEP 1: Create messages (one for community, one for workshop)
// ============================================================
console.log('STEP 1: Create messages...');

async function createMessage(html, label) {
  console.log(`  Creating ${label} message via v3 API...`);
  const body = JSON.stringify({
    message: {
      subject: SUBJECT,
      preheader_text: PREHEADER,
      fromname: FROM_NAME,
      fromemail: FROM_EMAIL,
      reply2: REPLY_TO,
      format: 'mime',
      charset: 'utf-8',
      encoding: '7bit',
      html: html,
      text: 'View this email in HTML.',
      userid: 1,
      ed_instanceid: 1,
      ed_version: 2,
    }
  });
  const res = await fetch(`${v3}/messages`, { method: 'POST', headers: v3headers, body });
  const txt = await res.text();
  console.log(`    POST /messages → ${res.status}`);
  if (!res.ok) {
    console.log(`    body: ${txt.slice(0, 500)}`);
    throw new Error('v3 message create failed');
  }
  const j = JSON.parse(txt);
  console.log(`    ✓ ${label} message id: ${j.message?.id}`);
  return j.message.id;
}

const msgCommunityId = await createMessage(HTML_COMMUNITY, 'COMMUNITY (v17)');
const msgWorkshopId = await createMessage(HTML_WORKSHOP, 'WORKSHOP (v16)');

// ============================================================
// STEP 2: Get/create segments via v3 (v3 segment API works for reading)
// We'll create campaign-level filter using sub-list filter ("any" condition on multiple tags)
// AC v1 supports `filter` via custom fields and tags via the "campaign create" but is tricky.
// Simpler: create explicit segments via v3, then attach to campaign.
// ============================================================
console.log('STEP 2: Create segments via v3...');

async function createSegment(name, conditions) {
  const body = JSON.stringify({ segment: { name, logic: conditions } });
  const res = await fetch(`${v3}/segments`, { method: 'POST', headers: v3headers, body });
  const text = await res.text();
  console.log(`  POST /segments → ${res.status}`);
  if (!res.ok) console.log(`    body: ${text.slice(0, 300)}`);
  return res.ok ? JSON.parse(text).segment.id : null;
}

// Test segment creation
const workshopSegConditions = [
  { type: 'group', operator: 'OR', conditions: WORKSHOP_TAG_IDS.map(tid => ({ field: 'tag', operator: 'contains', value: tid })) }
];
const communitySegConditions = [
  { type: 'group', operator: 'AND', conditions: WORKSHOP_TAG_IDS.map(tid => ({ field: 'tag', operator: 'notcontains', value: tid })) }
];

const workshopSegId = await createSegment('Skool Launch Workshop Segment', workshopSegConditions);
const communitySegId = await createSegment('Skool Launch Community Segment', communitySegConditions);

// ============================================================
// STEP 3: Create campaigns linked to messages + segments
// ============================================================
console.log('STEP 3: Create campaigns...');

async function createCampaign(name, messageId, segmentId) {
  console.log(`  Creating campaign "${name}"...`);
  const params = {
    type: 'single',
    name: name,
    public: 0,
    tracklinks: 'all',
    trackreads: 1,
    htmlfetch: 0,
    textfetch: 0,
    status: 1,
    sdate: SDATE,
  };
  params['p[0]'] = LIST_ID;
  params[`m[${messageId}]`] = 100; // weight 100% to this message
  if (segmentId) {
    params.segmentid = segmentId;
  }
  const res = await v1('campaign_create', params);
  console.log(`    ✓ ${name} campaign id: ${res.id}`);
  return res.id;
}

const campCommunity = await createCampaign('Skool Launch — Community (AC non-workshop)', msgCommunityId, communitySegId);
const campWorkshop = await createCampaign('Skool Launch — Workshop (AC workshop-tagged)', msgWorkshopId, workshopSegId);

// ============================================================
// STEP 4: Verify
// ============================================================
console.log('STEP 4: Verify...');

async function verifyCampaign(id, label) {
  const res = await v1('campaign_list', { ids: id });
  console.log(`  ${label} (id ${id}):`);
  console.log(`    status: ${res['0']?.status}`);
  console.log(`    sdate: ${res['0']?.sdate}`);
  console.log(`    name: ${res['0']?.name}`);
}
await verifyCampaign(campCommunity, 'AC COMMUNITY');
await verifyCampaign(campWorkshop, 'AC WORKSHOP');

console.log('');
console.log('============================================================');
console.log('AC SCHEDULED — community + workshop sends both at 9 AM Pacific');
console.log('============================================================');
