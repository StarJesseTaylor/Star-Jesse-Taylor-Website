import fs from 'fs';
const CONFIG = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const URL = CONFIG.apiUrl + '/admin/api.php';
const KEY = CONFIG.apiKey;

// Minimal campaign creation test
const params = new URLSearchParams();
params.append('api_action', 'campaign_create');
params.append('api_output', 'json');
params.append('api_key', KEY);
params.append('type', 'single');
params.append('name', 'TEST DELETE ME ' + Date.now());
params.append('public', '0');
params.append('tracklinks', 'all');
params.append('trackreads', '1');
params.append('htmlfetch', '0');
params.append('textfetch', '0');
params.append('status', '0'); // draft
params.append('sdate', '2026-06-28 09:00:00');
params.append('p[3]', '3'); // list ID 3 mapped to list 3
params.append('m[9]', '100'); // message 9 weight 100

const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
console.log(`status: ${res.status}`);
console.log(`headers: ${[...res.headers.entries()].map(([k,v]) => `${k}=${v}`).join('\n  ')}`);
const text = await res.text();
console.log(`body length: ${text.length}`);
console.log(`body: ${text.slice(0, 2000)}`);
