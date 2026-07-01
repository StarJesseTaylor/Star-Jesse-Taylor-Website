#!/usr/bin/env node
/**
 * Replace MailChimp-style merge tags in the AC-bound HTML with AC's equivalents.
 * Keep the MailChimp HTML untouched (those tags work fine in MC).
 *
 * Tag mapping (MC → AC):
 *   *|EMAIL|*           → %CONTACT_EMAIL%
 *   *|UNSUB|*           → %UNSUBSCRIBE_LINK%
 *   *|ABOUT_LIST|*      → (remove "why did I get this" link entirely — AC doesn't have one)
 *   *|UPDATE_PROFILE|*  → (remove "update subscription preferences" — AC handles via %UNSUBSCRIBE_LINK%)
 *   *|LIST:ADDRESSLINE|* → hardcoded company address
 */
import fs from 'fs';

const ADDRESS = 'Emotional Fitness Company · 8000 Sunset Blvd · Los Angeles, CA 90046';

function convertForAC(html) {
  // EMAIL: AC uses %CONTACT_EMAIL%
  html = html.replace(/\*\|EMAIL\|\*/g, '%CONTACT_EMAIL%');

  // The entire 3-link row → just one unsubscribe link
  html = html.replace(
    /<a href="\*\|ABOUT_LIST\|\*"[^>]*><em>why did I get this\?<\/em><\/a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="\*\|UNSUB\|\*"[^>]*>unsubscribe from this list<\/a>&nbsp;&nbsp;&nbsp;&nbsp;<a href="\*\|UPDATE_PROFILE\|\*"[^>]*>update subscription preferences<\/a>/g,
    '<a href="%UNSUBSCRIBE_LINK%" style="color:#404040 !important;">unsubscribe</a>'
  );

  // Address line
  html = html.replace(/\*\|LIST:ADDRESSLINE\|\*/g, ADDRESS);

  // Sanity: any remaining MC tags? Replace all with empty so they don't break anything
  const remaining = html.match(/\*\|[A-Z_:]+\|\*/g);
  if (remaining) {
    console.log(`⚠ Stripping ${remaining.length} additional MC tags: ${[...new Set(remaining)].join(', ')}`);
    html = html.replace(/\*\|[A-Z_:]+\|\*/g, '');
  }

  return html;
}

const v17 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');
const v16 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-LATEST.html', 'utf8');

const v17AC = convertForAC(v17);
const v16AC = convertForAC(v16);

fs.writeFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-AC.html', v17AC);
fs.writeFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-AC.html', v16AC);

console.log(`✓ v17-AC.html saved (${v17AC.length} chars)`);
console.log(`✓ v16-AC.html saved (${v16AC.length} chars)`);

// Verify no MC tags remain
const remaining17 = v17AC.match(/\*\|[A-Z_:]+\|\*/g);
const remaining16 = v16AC.match(/\*\|[A-Z_:]+\|\*/g);
console.log(`v17-AC remaining MC tags: ${remaining17 ? remaining17.length : 0}`);
console.log(`v16-AC remaining MC tags: ${remaining16 ? remaining16.length : 0}`);

// Push the AC versions to AC messages
const ac = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));

async function pushAC(id, html, subject) {
  const r = await fetch(`${ac.apiUrl}/api/3/messages/${id}`, {
    method: 'PUT',
    headers: { 'Api-Token': ac.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { html, subject } }),
  });
  console.log(`msg ${id}: ${r.status} ${r.ok ? '✓ updated' : (await r.text()).slice(0,200)}`);
}

console.log('\n━━━ Pushing AC-compatible HTML to AC messages ━━━');
await pushAC(11, v17AC, 'Are you tired of constantly fighting with your brain?');
await pushAC(12, v16AC, 'Online workshop announcement');
