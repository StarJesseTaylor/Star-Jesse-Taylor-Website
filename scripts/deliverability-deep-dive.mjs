#!/usr/bin/env node
/**
 * EXHAUSTIVE AC deliverability investigation.
 * No guessing. Hit every angle.
 *
 *  1. AC API: try EVERY endpoint that might reveal domain auth state
 *  2. DNS: exhaustive DKIM selector enumeration at AUTHORITATIVE
 *  3. DNS: probe all known AC subdomain patterns
 *  4. List everything AC's docs say should exist
 *  5. Compare with MailChimp's working setup (what's different)
 */
import fs from 'fs';
import { execSync } from 'child_process';

const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function api(path) {
  try {
    const r = await fetch(`${ac.apiUrl}${path}`, { headers: { 'Api-Token': ac.apiKey } });
    return { status: r.status, body: await r.text() };
  } catch (e) { return { status: 'ERR', body: e.message }; }
}

console.log('━━━ 1. AC API: try every endpoint that might reveal domain auth ━━━');
const ENDPOINTS = [
  '/api/3/dkim',
  '/api/3/dkims',
  '/api/3/domains',
  '/api/3/sending_domains',
  '/api/3/sendingDomains',
  '/api/3/authenticatedDomains',
  '/api/3/auth_domains',
  '/api/3/account',
  '/api/3/me',
  '/api/3/users',
  '/api/3/settings',
  '/api/3/config',
  '/api/3/branding',
  '/api/3/addresses',
];
for (const ep of ENDPOINTS) {
  const r = await api(ep);
  const preview = r.body.slice(0, 200).replace(/\s+/g, ' ');
  console.log(`  ${ep.padEnd(35)} → ${r.status}  ${preview}`);
}

console.log('\n━━━ 2. DNS: EXHAUSTIVE DKIM selector enumeration @ GoDaddy ━━━');
function dig(name, type, server = 'ns17.domaincontrol.com') {
  try {
    const out = execSync(`nslookup -type=${type} ${name} ${server} 2>&1`, { encoding: 'utf8', timeout: 5000 });
    return out;
  } catch (e) { return e.stdout || e.message; }
}

const SELECTORS = [
  // AC documented
  'cf2024-1', 'cf2024-2', 'cf2024-3',
  // Common AC-style
  'ac', 'ac1', 'ac2', 'ac3', 'ach', 'acmail', 'activecampaign', 'activehosted',
  'ac-default', 'ac-2024', 'ac-2025', 'ac-2026',
  // Generic
  'default', 'mail', 'mailer', 'dkim', 'dkim1', 'dkim2', 'dk', 'dk1', 'dk2',
  'k1', 'k2', 'k3', 's1', 's2', 's3', 'selector1', 'selector2', 'selector3',
  // MTA-style
  'mta', 'mta1', 'mta2', 'mte1', 'mte2',
  // Mailgun/Sendgrid style (AC uses similar)
  'pic', 'pic1', 'pic2', 'k', 's', 'em', 'em1', 'em2',
  // Year-based
  '2024', '2025', '2026', '20240101',
  // Bare hash-style
  'abcd1234', 'default1', 'default2',
];

const foundCnames = [];
for (const sel of SELECTORS) {
  const out = dig(`${sel}._domainkey.starjessetaylor.com`, 'CNAME');
  if (out.match(/canonical name|alias|=/i) && !out.includes("can't find") && !out.includes('NXDOMAIN')) {
    const match = out.match(/canonical name\s*=\s*(\S+)/i) || out.match(/=\s*(\S+\..*)/);
    if (match) { console.log(`  ✓ FOUND: ${sel}._domainkey → ${match[1]}`); foundCnames.push(sel); }
  }
}
if (!foundCnames.length) console.log('  (no DKIM CNAMEs found at any of these selectors)');

console.log('\n━━━ 3. Probe ALL known AC subdomain patterns ━━━');
const SUBS = [
  'em', 'em1', 'em2', 'em3',
  'ac', 'ac1', 'ac2',
  'mta', 'mta1', 'mta2',
  'mail', 'mailer', 'send', 'sending',
  'bounce', 'bounces', 'return', 'reply',
  'r1', 'r2', 'rp',
  'link', 'links', 'trk', 'tracking', 'click',
  'emcampaign', 'campaign', 'campaigns',
  'cf', 'cf-mail',
  '4127473',
];
for (const sub of SUBS) {
  const out = dig(`${sub}.starjessetaylor.com`, 'CNAME');
  if (out.match(/canonical name/i) && !out.includes("can't find") && !out.includes('NXDOMAIN')) {
    const match = out.match(/canonical name\s*=\s*(\S+)/i);
    if (match) console.log(`  ✓ FOUND: ${sub}.starjessetaylor.com → ${match[1]}`);
  }
  const txtOut = dig(`${sub}.starjessetaylor.com`, 'TXT');
  if (txtOut.match(/text\s*=\s*"/) && !txtOut.includes("can't find")) {
    const txtMatch = txtOut.match(/"([^"]+)"/g);
    if (txtMatch) console.log(`  ✓ TXT ${sub}.starjessetaylor.com: ${txtMatch.slice(0,2).join(' ')}`);
  }
}

console.log('\n━━━ 4. Re-verify SPF chain (does AC appear anywhere?) ━━━');
console.log('  Root SPF:');
console.log('  ' + (dig('starjessetaylor.com', 'TXT').match(/"v=spf1[^"]*"/) || ['(none)'])[0]);
console.log('  SPF wrapper:');
console.log('  ' + (dig('dc-aa8e722993._spfm.starjessetaylor.com', 'TXT').match(/"v=spf1[^"]*"/) || ['(none)'])[0]);
console.log('  DMARC:');
console.log('  ' + (dig('_dmarc.starjessetaylor.com', 'TXT').match(/"v=DMARC1[^"]*"/) || ['(none)'])[0]);

console.log('\n━━━ 5. What AC docs say is needed for domain auth ━━━');
console.log('  Per AC docs (Knowledge Base):');
console.log('  - SPF: add AC to your domain SPF — typically  include:_spf.<your-AC-acct>.activehosted.com');
console.log('  - DKIM: AC creates a CNAME at <hash>._domainkey.your-domain → <hash>._dkim.activehosted.com');
console.log('  - DMARC: any valid v=DMARC1 record (we have p=none — that\'s fine)');
console.log('  - Verification: AC validates by polling DNS');

console.log('\n━━━ 6. Check AC account-specific SPF subdomain ━━━');
// AC commonly creates a CNAME like _spf.<your_acct>.starjessetaylor.com
for (const variant of ['_spf', 'spf', '_acdkim', 'acdkim', '_amazonses']) {
  const out = dig(`${variant}.starjessetaylor.com`, 'TXT');
  if (out.match(/text\s*=/) && !out.includes("can't find")) {
    const m = out.match(/"([^"]+)"/);
    if (m) console.log(`  ✓ ${variant}.starjessetaylor.com TXT = ${m[1]}`);
  }
  const cOut = dig(`${variant}.starjessetaylor.com`, 'CNAME');
  if (cOut.match(/canonical/i) && !cOut.includes("can't find")) {
    const m = cOut.match(/canonical name\s*=\s*(\S+)/);
    if (m) console.log(`  ✓ ${variant}.starjessetaylor.com CNAME = ${m[1]}`);
  }
}

console.log('\n━━━ DONE ━━━');
console.log('NEXT — to KNOW for certain, send a real test from AC UI');
console.log('Then I read the email\'s Authentication-Results header — that\'s the ground truth.');
