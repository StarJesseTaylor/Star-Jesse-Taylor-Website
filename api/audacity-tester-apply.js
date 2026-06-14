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
    `Email: ${applicant.email || ''}`,
    `Apple ID email: ${applicant.appleEmail || '(same as above)'}`,
    `Device: ${applicant.device || ''}`,
    `2FA: ${applicant.twofa || ''}`,
    '',
    `Symptoms: ${(applicant.symptoms || '').split('|').filter(Boolean).join(', ')}`,
    `Working toward: ${(applicant.goals || '').split('|').filter(Boolean).join(', ')}`,
    `Duration: ${applicant.duration || ''}`,
    `Severity (1-10): ${applicant.severity || ''}`,
    `Tried: ${(applicant.tried || '').split('|').filter(Boolean).join(', ')}`,
    `History with Star: ${(applicant.history || '').split('|').filter(Boolean).join(', ')}`,
    `Commitment: ${applicant.commitment || ''}`,
    `Feedback channels: ${(applicant.feedback || '').split('|').filter(Boolean).join(', ')}`,
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
        from: 'Audacity Tester Apps <hello@starjessetaylor.com>',
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
      "Thanks for applying to test Audacity.",
      '',
      "Right now Audacity is iPhone only. I'm building Android in parallel and it'll launch a few weeks after the iPhone version. I'll email you the moment it's ready.",
      '',
      "In the meantime, follow along at instagram.com/starjessetaylor.",
      '',
      'Star'
    ].join('\n');
  } else if (scored.tier === 'a') {
    bodyText = [
      name ? `Hey ${name},` : 'Hey,',
      '',
      "Thanks for applying to test Audacity. Your application is a strong fit for what I'm looking for.",
      '',
      "Within 48 hours you'll get an invitation email from Apple titled 'You've been invited to App Store Connect.' Accept that first. Then you'll get a second email from TestFlight to install the app on your iPhone.",
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
      "Thanks for applying to test Audacity.",
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
        subject: name ? `${name}, about your Audacity tester application` : 'About your Audacity tester application',
        html,
        text: bodyText
      })
    });
  } catch (err) {
    console.error('Applicant confirmation failed:', err);
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

  if (!data.email || !data.firstName) {
    return res.status(400).json({ error: 'First name and email required' });
  }

  // Re-score server-side (don't trust client)
  const scored = scoreServer(data);
  data.tier = scored.tier;
  data.score = scored.score;

  // Fire-and-forget emails
  sendStarNotification(data, scored).catch(err => console.error(err));
  sendApplicantConfirmation(data, scored).catch(err => console.error(err));

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
    if (data.twofa === 'need_help') tags.push('tester-needs-2fa-help');

    await Promise.all(tags.map(t => applyTag(AC_URL, headers, contactId, t)));

    return res.status(200).json({ success: true, scored, contactId });
  } catch (err) {
    console.error('Tester apply error:', err);
    return res.status(200).json({ success: true, scored, warning: 'AC failed, email sent' });
  }
}
