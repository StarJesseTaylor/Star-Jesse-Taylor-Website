#!/usr/bin/env node
/** Send the Audacity "bicycle" email (message 33) to Master list (3) via proven v1 pattern. */
import fs from 'fs';
import { abortIfAlreadySent, verifySent } from './ac-send-guard.mjs';
const CFG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const BASE = CFG.apiUrl;
const LIST = 3;            // Master Contact List (includes all 164 doubles + the 9 added)
const MSG = 33;           // bicycle email
const CAMPAIGN_NAME = 'PROD Audacity bicycle AC Jun29';
const SDATE = '2026-06-29 12:00:00'; // PAST Central time -> fires immediately

const GET = async (p) => { const r = await fetch(BASE + p, { headers: { 'Api-Token': CFG.apiKey } }); return JSON.parse(await r.text()); };
const v1 = async (action, params) => {
  const url = `${BASE}/admin/api.php?api_action=${action}&api_key=${CFG.apiKey}&api_output=json`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t }; }
};

await abortIfAlreadySent(GET, CAMPAIGN_NAME);

const list = await GET('/api/3/lists/3');
const active = Number(list.list?.active_subscribers);
console.log('Master active subscribers:', active);
if (active < 200 || active > 400) { console.log('SAFETY ABORT: Master count', active, 'outside expected 200-400'); process.exit(1); }

const camp = await v1('campaign_create', {
  type: 'single', name: CAMPAIGN_NAME, sdate: SDATE,
  status: 1, public: 0, tracklinks: 'all', trackreads: 1,
  [`p[${LIST}]`]: String(LIST), [`m[${MSG}]`]: '100',
});
console.log(`campaign_create -> code=${camp.result_code} msg="${camp.result_message}" id=${camp.id}`);

const res = await verifySent(GET, camp.id, null);
console.log('='.repeat(50));
console.log(`AC SENT. send_amt = ${res.sent}`);
console.log('='.repeat(50));
