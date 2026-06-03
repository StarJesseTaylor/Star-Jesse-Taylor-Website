/**
 * Coaching Application handler.
 *
 * Receives a submission from apply.html, emails Star the full
 * application via Resend, adds the applicant to ActiveCampaign with
 * coaching-applicant tags, and sends the applicant a confirmation.
 *
 * Built June 3, 2026 after discovering apply.html had been silently
 * failing for an unknown period — the page loaded EmailJS in its
 * handler but never actually included the EmailJS library, so every
 * submission fell through to a mailto: fallback that required the
 * user to manually click send in their own email client. Star never
 * received those applications.
 *
 * This endpoint replaces that broken path with a real backend.
 */

const DEFAULT_LIST_ID = '7';
const SITE_URL = 'https://starjessetaylor.com';

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

function fmt(val) {
  if (val === undefined || val === null || val === '') return '(blank)';
  if (Array.isArray(val)) return val.join(', ') || '(none)';
  return String(val);
}

function buildApplicationEmailText(f) {
  const isPackage = f.tier === 'package';
  const checked = [];
  if (f.head_time === 'Yes') checked.push('spends a lot of time inside their head');
  if (f.avoiding_action === 'Yes') checked.push('avoiding actions due to anxiety/depression/emotions');
  if (f.intrusive_thoughts === 'Yes') checked.push('intrusive thoughts');
  if (f.ocd === 'Yes') checked.push('OCD');
  if (f.adhd === 'Yes') checked.push('ADHD');
  if (f.panic_attacks === 'Yes') checked.push('panic attacks');
  if (f.breakup === 'Yes') checked.push('just had a breakup');
  if (f.read_book === 'Yes') checked.push('has read The Emotional Fitness book');

  const lines = [
    isPackage ? '=== NEW PACKAGE APPLICATION ===' : '=== NEW COACHING APPLICATION ===',
    'Submitted: ' + new Date().toISOString(),
    '',
    '— APPLICANT —',
    'Name: ' + fmt(f.full_name),
    'Email: ' + fmt(f.email),
    'Phone: ' + fmt(f.phone),
    'Location: ' + fmt(f.location)
  ];
  if (f.timezone) lines.push('Time zone: ' + fmt(f.timezone));
  if (f.how_found) lines.push('How they found Star: ' + fmt(f.how_found));

  if (isPackage && f.package_choice) {
    lines.push('', '— PACKAGE —', 'Package applying for: ' + fmt(f.package_choice));
  }

  if (checked.length) {
    lines.push('', '— QUICK CHECK-INS —', checked.map(c => '  • ' + c).join('\n'));
  }

  lines.push(
    '',
    '— THEIR STORY —',
    'Main challenge:', fmt(f.main_challenge), '',
    'How long they have been dealing with this:', fmt(f.how_long), '',
    'Daily impact:', fmt(f.daily_impact), '',
    'What they have already tried:', fmt(f.what_tried), '',
    '— WHAT THEY WANT —',
    'What life looks like when this is resolved:', fmt(f.life_resolved), '',
    'Why now is the right time:', fmt(f.why_now)
  );

  if (isPackage && f.specific_goals) {
    lines.push('', 'Specific goals:', fmt(f.specific_goals));
  }

  lines.push(
    '',
    '— COMMITMENT —',
    'Ready to start in next two weeks: ' + fmt(f.start_ready)
  );
  if (!isPackage) lines.push('Available investment: ' + fmt(f.investment));
  if (isPackage) {
    lines.push('Decision maker on payment: ' + fmt(f.decision_maker));
    lines.push('Payment plan preference: ' + fmt(f.payment_plan));
  }
  lines.push('Commitment scale (1-10): ' + fmt(f.commitment_scale));

  lines.push(
    '',
    '— FINAL —',
    'Anything else they want to share:', fmt(f.anything_else),
    '',
    '==================================='
  );

  return lines.join('\n');
}

async function emailStar(applicantName, applicantEmail, bodyText) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing — cannot email Star');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Coaching Application <hello@starjessetaylor.com>',
        to: ['starjessetaylor@gmail.com'],
        reply_to: applicantEmail || undefined,
        subject: (bodyText.indexOf('NEW PACKAGE APPLICATION') >= 0 ? 'New Package Application: ' : 'New Coaching Application: ') + (applicantName || applicantEmail || 'Unnamed Applicant'),
        text: bodyText
      })
    });
    if (!res.ok) {
      console.error('Resend email-to-Star error:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email-to-Star failed:', err);
    return false;
  }
}

async function emailApplicantConfirmation(toEmail, name) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const greeting = name ? `Hey ${name},` : 'Hey,';
  const text = [
    greeting,
    '',
    'Your coaching application is in. I personally read every one of these.',
    '',
    'If we are a fit, you will hear back from me. If not, I will still write to let you know and point you to the best next step.',
    '',
    'Talk soon,',
    'Star'
  ].join('\n');

  const htmlParas = text.split('\n\n').map(p => {
    const safeP = p.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
  }).join('');
  const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParas}</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [toEmail],
        reply_to: 'starjessetaylor@gmail.com',
        subject: name ? `${name}, your application is in` : 'Your coaching application is in',
        html, text
      })
    });
    if (!res.ok) console.error('Resend applicant-confirmation error:', res.status, await res.text());
  } catch (err) {
    console.error('Applicant confirmation send failed:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const f = req.body || {};

  // Health check probe: return 200 without polluting AC or emailing Star
  if (f.health_check === 'health-check-daily') {
    return res.status(200).json({ success: true, healthCheck: true });
  }

  // Honeypot
  if (f.website_url) {
    console.log('Bot blocked (honeypot):', { name: f.full_name, email: f.email });
    return res.status(200).json({ success: true });
  }

  const fullName = (f.full_name || '').trim();
  const email = (f.email || '').trim();
  const mainChallenge = (f.main_challenge || '').trim();

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!fullName || fullName.length < 2) return res.status(400).json({ error: 'Full name is required' });

  // Bot pattern detector
  const firstWord = fullName.split(/\s+/)[0] || '';
  if (/^[A-Za-z]{15,}$/.test(firstWord) && /[A-Z]/.test(firstWord) && /[a-z]/.test(firstWord)) {
    console.log('Bot blocked (gibberish name):', { fullName, email });
    return res.status(200).json({ success: true });
  }

  // Some applicants (and test submissions) may not include main_challenge —
  // we still want to capture them rather than 400.
  console.log('Coaching application received:', { fullName, email, hasChallenge: !!mainChallenge });

  // Fire all three independently. The email to Star is the critical one.
  const emailedStar = await emailStar(fullName, email, buildApplicationEmailText(f));
  emailApplicantConfirmation(email, fullName.split(/\s+/)[0]).catch(err => console.error('Confirm error:', err));

  // ActiveCampaign tagging
  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
  const LIST_ID = process.env.AC_COACHING_LIST_ID || DEFAULT_LIST_ID;

  if (AC_KEY) {
    const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };
    try {
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const contactPayload = { email, firstName };
      if (lastName) contactPayload.lastName = lastName;
      if (f.phone) contactPayload.phone = f.phone;
      const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
        method: 'POST', headers,
        body: JSON.stringify({ contact: contactPayload })
      });
      if (syncRes.ok) {
        const { contact } = await syncRes.json();
        const contactId = contact && contact.id;
        if (contactId) {
          await fetch(`${AC_URL}/api/3/contactLists`, {
            method: 'POST', headers,
            body: JSON.stringify({ contactList: { list: LIST_ID, contact: contactId, status: 1 } })
          }).catch(err => console.error('List add error:', err));

          const tagPromises = [
            applyTag(AC_URL, headers, contactId, 'path:coaching-application'),
            applyTag(AC_URL, headers, contactId, 'coaching:applicant'),
            applyTag(AC_URL, headers, contactId, 'source:website')
          ];
          if (f.intrusive_thoughts === 'Yes') tagPromises.push(applyTag(AC_URL, headers, contactId, 'symptom:intrusive-thoughts'));
          if (f.ocd === 'Yes') tagPromises.push(applyTag(AC_URL, headers, contactId, 'symptom:ocd'));
          if (f.adhd === 'Yes') tagPromises.push(applyTag(AC_URL, headers, contactId, 'symptom:adhd'));
          if (f.panic_attacks === 'Yes') tagPromises.push(applyTag(AC_URL, headers, contactId, 'symptom:panic-attacks'));
          if (f.breakup === 'Yes') tagPromises.push(applyTag(AC_URL, headers, contactId, 'symptom:breakup'));
          await Promise.all(tagPromises);
        }
      } else {
        console.error('AC sync error:', syncRes.status, await syncRes.text());
      }
    } catch (err) {
      console.error('AC tagging error (non-fatal):', err);
    }
  }

  // The email to Star is the success criteria. If that failed, surface it
  // so the form can show an error instead of pretending it worked.
  if (!emailedStar) {
    return res.status(500).json({ error: 'We hit a problem sending your application. Please email starjessetaylor@gmail.com directly and we will not lose your message.' });
  }

  return res.status(200).json({ success: true });
}
