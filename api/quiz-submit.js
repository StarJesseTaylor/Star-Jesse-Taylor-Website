/**
 * Quiz submission handler.
 *
 * Receives quiz answers + email + name, stores the contact in ActiveCampaign,
 * applies tags by quiz path and pain segment, saves a note containing the
 * full quiz response, and sends a welcome email via Resend with the free
 * chapter link and a path-specific next step.
 *
 * Tag names used (Star creates these in AC, no IDs needed in code):
 *   path:book, path:courses, path:intensive, path:cohort, path:coaching
 *   symptom:anxiety_ocd, symptom:stuck, symptom:self_worth, symptom:new
 *   pain:high (8-10), pain:medium (5-7), pain:low (1-4)
 */

const LIST_ID = '4'; // Quiz Funnel List
const FREE_CHAPTER_URL = 'https://shop.beacons.ai/starjessetaylor/6081c7e3-2b8f-4c18-ae93-c09042c1de4a';
const SITE_URL = 'https://starjessetaylor.com';

const PATH_DETAILS = {
  book: {
    label: 'Start with the book',
    desc: 'The book is where everything Star teaches begins. The Value Garden, the No Brain Method, the daily practice. At $29, it is the highest-leverage thing you can do right now.',
    cta: 'Get the book',
    url: 'https://starjessetaylor.bio/shop/51c9e967-da06-4c5a-adf3-5d79d32e30da'
  },
  courses: {
    label: 'The self-paced courses',
    desc: 'You are ready to learn at your own pace. The Emotional Fitness courses give you real tools, real practices, real structure, without a coaching commitment.',
    cta: 'Browse the courses',
    url: SITE_URL + '/courses.html'
  },
  intensive: {
    label: 'The Emotional Fitness Intensive',
    desc: 'You need momentum. The Intensive is a live focused experience designed to give you a real breakthrough in a short time. For people done theorizing.',
    cta: 'See the Intensive',
    url: SITE_URL + '/services.html'
  },
  cohort: {
    label: 'The 10-Week Cohort',
    desc: 'You are ready for a full structured program with others doing the real work. Built-in accountability, the full framework, lasting community.',
    cta: 'Join the waitlist',
    url: SITE_URL + '/services.html'
  },
  coaching: {
    label: '1-on-1 Coaching With Star',
    desc: 'You are not here for a general solution. 1-on-1 coaching is the fastest path to the deepest change. Star works with a small number of private clients.',
    cta: 'Apply for coaching',
    url: SITE_URL + '/apply.html'
  }
};

const SYMPTOM_TAGS = {
  anxiety_ocd: 'symptom:anxiety_ocd',
  stuck: 'symptom:stuck',
  self_worth: 'symptom:self_worth',
  new: 'symptom:new'
};

const PATH_TAGS = {
  book: 'path:book',
  courses: 'path:courses',
  intensive: 'path:intensive',
  cohort: 'path:cohort',
  coaching: 'path:coaching'
};

function painBucket(score) {
  const n = parseInt(score, 10);
  if (isNaN(n)) return 'pain:unknown';
  if (n >= 8) return 'pain:high';
  if (n >= 5) return 'pain:medium';
  return 'pain:low';
}

async function sendWelcomeEmail(toEmail, name, result) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping welcome email');
    return;
  }
  const path = PATH_DETAILS[result] || PATH_DETAILS.book;
  const greeting = name ? `Hey ${name},` : 'Hey,';

  const text = [
    greeting,
    '',
    'Thanks for taking the quiz. Here is what came back for you.',
    '',
    'Your path: ' + path.label,
    '',
    path.desc,
    '',
    'Next step: ' + path.cta + ' → ' + path.url,
    '',
    'And as promised, here are the first 30 pages of the book, free:',
    FREE_CHAPTER_URL,
    '',
    'The book is the foundation of everything I teach. Read the first 30 pages, and you will already feel a shift in how you relate to your own mind.',
    '',
    'I am rooting for you.',
    '',
    'Star'
  ].join('\n');

  const htmlParagraphs = text.split('\n\n').map(p => {
    const safeP = p.replace(/\n/g, '<br/>');
    return `<p style="margin:0 0 18px;line-height:1.65;color:#2C2C2C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">${safeP}</p>`;
  }).join('');
  const ctaButton = `<p style="margin:24px 0;"><a href="${path.url}" style="display:inline-block;background:#1B6CA8;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">${path.cta} →</a></p>`;
  const chapterButton = `<p style="margin:24px 0;"><a href="${FREE_CHAPTER_URL}" style="display:inline-block;background:#fff;color:#1B6CA8;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;border:2px solid #1B6CA8;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">Read the First 30 Pages →</a></p>`;
  const html = `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;">${htmlParagraphs}${ctaButton}${chapterButton}</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Star Jesse Taylor <hello@starjessetaylor.com>',
        to: [toEmail],
        reply_to: 'starjessetaylor@gmail.com',
        subject: name ? `${name}, your Emotional Fitness path is here` : 'Your Emotional Fitness path is here',
        html,
        text
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend error:', res.status, errText);
    }
  } catch (err) {
    console.error('Welcome email send failed:', err);
  }
}

async function applyTag(AC_URL, headers, contactId, tagName) {
  // Find or create tag by name, then attach to contact
  try {
    const search = await fetch(`${AC_URL}/api/3/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET',
      headers
    });
    let tagId = null;
    if (search.ok) {
      const data = await search.json();
      const match = (data.tags || []).find(t => t.tag === tagName);
      if (match) tagId = match.id;
    }
    if (!tagId) {
      const create = await fetch(`${AC_URL}/api/3/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tag: { tag: tagName, tagType: 'contact' } })
      });
      if (create.ok) {
        const data = await create.json();
        tagId = data.tag && data.tag.id;
      }
    }
    if (!tagId) return;
    await fetch(`${AC_URL}/api/3/contactTags`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } })
    });
  } catch (err) {
    console.error('Tag error for', tagName, err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name,
    email,
    phone,
    result,        // 'book' | 'courses' | 'intensive' | 'cohort' | 'coaching'
    symptom,       // 'anxiety_ocd' | 'stuck' | 'self_worth' | 'new'
    painScore,     // 1-10
    stakes,        // free-text: what changes if they solve this
    answers        // raw answers object for the note { q1, q2, q3, q4 }
  } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always log so we have a record even if AC is unreachable
  console.log('Quiz submission:', { name, email, result, symptom, painScore, stakes });

  // Send the welcome email + chapter link immediately so the user receives
  // it whether or not ActiveCampaign is configured.
  sendWelcomeEmail(email, name, result).catch(err => console.error('Welcome email error:', err));

  const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
  const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');

  if (!AC_KEY) {
    // No AC configured, but the welcome email already fired
    return res.status(200).json({ success: true, note: 'AC not configured, email sent via Resend only' });
  }

  const headers = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };

  try {
    // 1. Sync contact (creates or updates)
    const syncRes = await fetch(`${AC_URL}/api/3/contact/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contact: {
          email,
          firstName: name || '',
          phone: phone || ''
        }
      })
    });

    if (!syncRes.ok) {
      const text = await syncRes.text();
      console.error('AC sync error:', syncRes.status, text);
      return res.status(500).json({ error: 'Failed to create contact' });
    }

    const { contact } = await syncRes.json();
    const contactId = contact && contact.id;
    if (!contactId) return res.status(500).json({ error: 'No contact ID returned' });

    // 2. Subscribe to Master Contact List
    await fetch(`${AC_URL}/api/3/contactLists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactList: { list: LIST_ID, contact: contactId, status: 1 }
      })
    }).catch(err => console.error('List add error:', err));

    // 3. Apply tags (path, symptom, pain bucket, plus Free Chapter Download
    //    to trigger Star's existing AC automation that emails the first 30
    //    pages of the book)
    const tagsToApply = [];
    if (result && PATH_TAGS[result]) tagsToApply.push(PATH_TAGS[result]);
    if (symptom && SYMPTOM_TAGS[symptom]) tagsToApply.push(SYMPTOM_TAGS[symptom]);
    if (painScore) tagsToApply.push(painBucket(painScore));
    tagsToApply.push('source:quiz');
    tagsToApply.push('Free Chapter Download');

    await Promise.all(tagsToApply.map(tag => applyTag(AC_URL, headers, contactId, tag)));

    // 4. Save full quiz data as a note for personalization later
    const noteLines = [
      'Quiz submission ' + new Date().toISOString(),
      'Result path: ' + (result || 'unknown'),
      'Primary symptom: ' + (symptom || 'unknown'),
      'Pain score (1-10): ' + (painScore != null ? painScore : 'not provided'),
      'Stakes (what changes if they solve this in 90 days):',
      stakes || '(skipped)',
      '',
      'Raw answers: ' + JSON.stringify(answers || {})
    ];
    await fetch(`${AC_URL}/api/3/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        note: {
          note: noteLines.join('\n'),
          relid: contactId,
          reltype: 'Subscriber'
        }
      })
    }).catch(err => console.error('Note error:', err));

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('Quiz submit error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
