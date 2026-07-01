#!/usr/bin/env node
/**
 * Update AC messages 11 (community v17) + 12 (workshop v16) with latest HTML.
 * Try PUT first; if not supported, create new messages.
 */
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('C:/Users/starj/.claude/secrets/activecampaign.json', 'utf8'));
const v17 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v17-FINAL.html', 'utf8');
const v16 = fs.readFileSync('C:/Users/starj/Documents/Star_Pricing_Research/workshop-email-v16-LATEST.html', 'utf8');

async function ac(path, opts = {}) {
  const r = await fetch(`${cfg.apiUrl}${path}`, {
    ...opts,
    headers: {
      'Api-Token': cfg.apiKey,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  return { status: r.status, body: text };
}

async function updateMessage(id, label, html, subject) {
  console.log(`\n— Trying PUT /api/3/messages/${id} (${label})`);
  const put = await ac(`/api/3/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: {
        subject,
        html,
        htmlfetch: 0,
      },
    }),
  });
  console.log(`  status: ${put.status}`);
  if (put.status === 200) {
    console.log(`  ✓ Updated message ${id}`);
    return id;
  }
  console.log(`  body: ${put.body.slice(0, 300)}`);
  console.log(`  → PUT failed; creating new message instead`);
  const create = await ac('/api/3/messages', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        userid: 1,
        format: 'html',
        fromname: 'Star Jesse Taylor',
        fromemail: 'starjessetaylor@gmail.com',
        reply2: 'starjessetaylor@gmail.com',
        subject,
        html,
        htmlfetch: 0,
        textfetch: 0,
        preheader_text: 'Why you can\'t stop fighting your brain, and what to do instead.',
      },
    }),
  });
  if (create.status >= 200 && create.status < 300) {
    const newId = JSON.parse(create.body).message.id;
    console.log(`  ✓ Created new message ${newId}`);
    return newId;
  }
  console.log(`  ✗ CREATE failed too: ${create.status} ${create.body.slice(0, 300)}`);
  return null;
}

const newCommunityId = await updateMessage(11, 'Community v17', v17, 'Are you tired of constantly fighting with your brain?');
const newWorkshopId = await updateMessage(12, 'Workshop v16', v16, 'Online workshop announcement');

console.log('\n=== AC UI URLs ===');
console.log(`Community msg: https://${cfg.apiUrl.match(/\/\/([^.]+)/)[1]}.activehosted.com/app/messages/${newCommunityId}/edit`);
console.log(`Workshop msg:  https://${cfg.apiUrl.match(/\/\/([^.]+)/)[1]}.activehosted.com/app/messages/${newWorkshopId}/edit`);
console.log(`All messages:  https://${cfg.apiUrl.match(/\/\/([^.]+)/)[1]}.activehosted.com/app/messages/`);
