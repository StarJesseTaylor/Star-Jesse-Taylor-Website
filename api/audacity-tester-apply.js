/**
 * Audacity tester application handler.
 *
 * Receives quiz form from /apply-tester.html. Scores the applicant
 * server-side (client-side score is informational only), then:
 *   1. Creates / updates contact in ActiveCampaign
 *   2. Tags symptoms + history + tier + device + commitment
 *   3. Emails Star with the full application + their score
 *   4. Sends applicant a confirmation in Star's voice
 *
 * Tags applied per applicant (so segmentation is real):
 *   path:audacity-tester-apply
 *   tester-tier-a / tester-tier-b / tester-tier-c
 *   tester-symptom-anxiety / -ocd / -depression / etc
 *   tester-history-1on1 / -group / -workshop / -course / -book / -social / -new
 *   tester-commitment-yes / -maybe / -just-try
 *   tester-device-iphone / -android-waitlist / -other
 *   tester-needs-2fa-help (if applicable)
 *
 * Required env vars (same as audacity-waitlist):
 *   ACTIVECAMPAIGN_API_KEY
 *   ACTIVECAMPAIGN_API_URL
 *   RESEND_API_KEY
 *   AC_AUDACITY_LIST_ID (optional, defaults to 3)
 */

const DEFAULT_LIST_ID = '3';

async function applyTag(AC_URL, headers, contactId, tagName) {
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET', headers
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find(t => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST', headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
      });
      if (create.ok) {
        const data = await create.json();
        tagId = data.tag && data.tag.id;
      }
    }
    if (!tagId) return;
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST', headers,
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

function scoreServer(d) {
  let score = 0;
  const sev = parseInt(d.severity || '0', 10);
  if (sev >= 7) score += 3;
  else if (sev >= 4) score += 1;

  if (d.duration === '5y_plus' || d.duration === '2y_5y') score += 2;
  else if (d.duration === '6m_2y') score += 1;

  const tried = (d.tried || '').split('|').filter(Boolean);
  if (tried.indexOf('nothing') === -1 && tried.length >= 2) score += 2;
  else if (tried.length === 1) score += 1;

  if ((d.worked || '').trim().length >= 30) score += 1;
  if ((d.not_worked || '').trim().length >= 30) score += 1;

  const sm = (d.specific_moment || '').trim();
  if (sm.length >= 120) score += 3;
  else if (sm.length >= 60) score += 1;

  if (d.commitment === 'yes') score += 4;
  else if (d.commitment === 'just_try') score -= 3;

  if (d.device === 'iphone') score += 1;
  else if (d.device === 'android' || d.device === 'other') score -= 5;

  let tier = 'c';
  if (score >= 10) tier = 'a';
  else if (score >= 5) tier = 'b';
  return { score, tier };
}

async function sendStarNotification(applicant, scored) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const lines = [
    `NEW TESTER APPLICATION — Tier ${scored.tier.toUpperCase()} (score ${scored.score})`,
    '',
    `Name:  ${applicant.firstName || ''} ${applicant.lastName || ''}`.trim(),
    `Apple ID email: ${applicant.appleEmail || applicant.email || ''}`,
    `Device: ${applicant.device || ''}`,
    '',
    `Symptoms: ${(applicant.symptoms || '').split('|').filter(Boolean).join(', ')}`,
    `Working toward: ${(applicant.goals || '').split('|').filter(Boolean).join(', ')}`,
    `Duration: ${applicant.duration || ''}`,
    `Severity (1-10): ${applicant.severity || ''}`,
    `Tried: ${(applicant.tried || '').split('|').filter(Boolean).join(', ')}`,
    `History with Star: ${(applicant.history || '').split('|').filter(Boolean).join(', ')}`,
    `Commitment: ${applicant.commitment || ''}`,
    '',
    'WHAT WORKED:',
    applicant.worked || '(empty)',
    '',
    'WHAT HASN\'T WORKED:',
    applicant.not_worked || '(empty)',
    '',
    'SPECIFIC RECENT MOMENT (gold question):',
    applicant.specific_moment || '(empty)',
    '',
    'OTHER NOTES:',
    applicant.notes || '(empty)',
    '',
    `Submitted ${new Date().toISOString()}`,
    `Source: ${applicant.source || 'website'}`,
  ];

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'App Tester Apps <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        subject: `[Tier ${scored.tier.toUpperCase()}] Tester applicant: ${applicant.firstName || applicant.email}`,
        text: lines.join('\n')
      })
    });
  } catch (err) {
    console.error('Star notification failed:', err);
  }
}

async function sendApplicantConfirmation(applicant, scored) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const name = applicant.firstName || '';
  let bodyText;

  if (applicant.device === 'android' || applicant.device === 'other') {
    bodyText = [
      name ? `Hey ${name},` : 'Hey,',
      '',
      "Thanks for applying to be a beta tester.",
      '',
      "Right now the app is iPhone only. I'm building Android in parallel and it'll launch a few weeks after the iPhone version. I'll email you the moment it's ready, and that's when I'll share the name and what it does.",
      '',
      "In the meantime, follow along at instagram.com/starjessetaylor.",
      '',
      'Star'
    ].join('\n');
  } else if (scored.tier === 'a') {
    bodyText = [
      name ? `Hey ${name},` : 'Hey,',
      '',
      "Thanks for applying to be a beta tester. Your application is a strong fit for what I'm looking for.",
      '',
      "Within 48 hours you'll get an invitation email from Apple titled 'You've been invited to App Store Connect.' Accept that first. Then you'll get a second email from TestFlight to install the app on your iPhone. That's when I'll share the name and what it does.",
      '',
      "When you have it, just use it however feels natural. When something is confusing or broken, screenshot it or text me. The point of you being early is your feedback.",
      '',
      'Talk soon.',
      'Star'
    ].join('\n');
  } else if (scored.tier === 'b') {
    bodyText = [
      name ? `Hey ${name},` : 'Hey,',
      '',
      "Thanks for applying. I read every application personally.",
      '',
      "If you're a fit for this beta batch, you'll hear back within a few days with TestFlight install instructions. If not, I'll let you know when the next batch opens up so you can try again.",
      '',
      "Either way, I appreciate you reaching out.",
      '',
      'Star'
    ].join('\n');
  } else {
    bodyText = [
      name ? `Hey ${name},` : 'Hey,',
      '',
      "Thanks for applying to be a beta tester.",
      '',
      "Beta capacity is limited right now and I'm picking testers who match very specific situations. I'll keep your application on file and reach out when a spot opens that matches what you're working with.",
      '',
      "If you want to follow along in the meantime, I'm at instagram.com/starjessetaylor.",
      '',
      'Star'
    ].join('\n');
  }

  const htmlParas = bodyText.split('\n\n').map(p => {
    const safeP = p.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
  }).join('');
  const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParas}</div>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [applicant.email],
        reply_to: 'starjessetaylor@gmail.com',
        subject: name ? `${name}, about your tester application` : 'About your tester application',
        html,
        text: bodyText
      })
    });
  } catch (err) {
    console.error('Applicant confirmation failed:', err);
  }
}

// Mirror the application into Supabase tester_applications so the admin
// dashboard at /testers has a fast, queryable source of truth with
// invited/declined status tracking. AC stays as the marketing list of
// record; Supabase is the triage workspace. Service role key bypasses
// RLS for server-side write; never exposed to client.
async function storeApplicationInSupabase(applicant, scored, acContactId) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('Supabase service key missing; skipping tester_applications insert');
    return null;
  }
  try {
    const row = {
      first_name: applicant.firstName || '',
      last_name: applicant.lastName || null,
      apple_email: applicant.appleEmail || applicant.email || '',
      device: applicant.device || null,
      symptoms: applicant.symptoms || null,
      goals: applicant.goals || null,
      duration: applicant.duration || null,
      severity: applicant.severity || null,
      tried: applicant.tried || null,
      worked: applicant.worked || null,
      not_worked: applicant.not_worked || null,
      specific_moment: applicant.specific_moment || null,
      history: applicant.history || null,
      commitment: applicant.commitment || null,
      notes: applicant.notes || null,
      source: applicant.source || null,
      score: scored.score,
      tier: scored.tier,
      ac_contact_id: acContactId ? String(acContactId) : null,
      status: 'pending'
    };
    const res = await fetch(`${supabaseUrl}/rest/v1/tester_applications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Supabase insert failed:', res.status, text);
      return null;
    }
    const inserted = await res.json().catch(() => null);
    return Array.isArray(inserted) ? inserted[0] : inserted;
  } catch (err) {
    console.error('Supabase insert exception:', err);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const data = req.body || {};

  // Honeypot
  if (data.website_url) {
    console.log('Bot blocked:', data.email);
    return res.status(200).json({ success: true });
  }

  // Only Apple ID email is collected now (Star June 14 simplification).
  // Map appleEmail -> email for downstream AC + Resend.
  if (data.appleEmail && !data.email) data.email = data.appleEmail;
  if (!data.email || !data.firstName) {
    return res.status(400).json({ error: 'First name and Apple ID email required' });
  }

  // Re-score server-side (don't trust client)
  const scored = scoreServer(data);
  data.tier = scored.tier;
  data.score = scored.score;

  // Fire-and-forget emails
  sendStarNotification(data, scored).catch(err => console.error(err));
  sendApplicantConfirmation(data, scored).catch(err => console.error(err));

  // Mirror into Supabase tester_applications for the admin dashboard.
  // Fire-and-forget so it never blocks the success response.
  storeApplicationInSupabase(data, scored, null).catch(err => console.error('Supabase mirror failed:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_AUDACITY_LIST_ID || DEFAULT_LIST_ID;

  if (!AC_KEY) {
    return res.status(200).json({ success: true, scored, note: 'AC not configured, captured via email only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // Build the contact with custom field for Apple ID email (field
    // ID needs to exist in AC; if not, the appleEmail is in the
    // Star notification email anyway).
    const contactPayload = {
      email: data.email,
      firstName: data.firstName || '',
    };
    if (data.lastName) contactPayload.lastName = data.lastName;

    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST', headers,
      body: JSON.stringify({ contact: contactPayload })
    });
    if (!syncRes.ok) {
      console.error('AC sync error:', syncRes.status, await syncRes.text());
      return res.status(200).json({ success: true, scored, warning: 'AC sync failed, email sent' });
    }
    const { contact } = await syncRes.json();
    const contactId = contact && contact.id;
    if (!contactId) return res.status(200).json({ success: true, scored, warning: 'no contact id, email sent' });

    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST', headers,
      body: JSON.stringify({ contactList: { list: LIST_ID, contact: contactId, status: 1 } })
    }).catch(err => console.error('List add error:', err));

    // Tag the whole story
    const tags = ['path:audacity-tester-apply', `tester-tier-${scored.tier}`];

    (data.symptoms || '').split('|').filter(Boolean).forEach(s => tags.push(`tester-symptom-${s}`));
    (data.goals || '').split('|').filter(Boolean).forEach(g => tags.push(`tester-goal-${g}`));
    (data.history || '').split('|').filter(Boolean).forEach(h => tags.push(`tester-history-${h}`));
    if (data.commitment) tags.push(`tester-commitment-${data.commitment}`);
    if (data.device === 'iphone') tags.push('tester-device-iphone');
    else if (data.device === 'android') tags.push('tester-device-android-waitlist');
    else if (data.device === 'other') tags.push('tester-device-other');
    await Promise.all(tags.map(t => applyTag(AC_URL, headers, contactId, t)));

    // Re-mirror with the AC contact ID now that we have it. Idempotent enough
    // for our scale — the earlier fire-and-forget call already inserted a row
    // without the AC id, and this one would insert a duplicate. Skip the
    // second call; the email digest still works either way.

    return res.status(200).json({ success: true, scored, contactId });
  } catch (err) {
    console.error('Tester apply error:', err);
    return res.status(200).json({ success: true, scored, warning: 'AC failed, email sent' });
  }
}
