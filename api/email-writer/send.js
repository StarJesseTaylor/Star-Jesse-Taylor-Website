/**
 * Email Writer: send to selected ActiveCampaign audience.
 *
 * POST /api/email-writer/send?key=CRON_SECRET
 * Body: {
 *   subject: string,
 *   body: string,
 *   tagIds: number[],     // contacts who have ALL of these tags
 *   excludeTagIds: number[], // (optional) contacts who have NONE of these
 *   mode: 'draft' | 'send-now' | 'schedule',
 *   scheduleAt?: string ISO timestamp (only if mode = 'schedule')
 * }
 *
 * Strategy: AC's campaign creation flow needs a message + list + segment.
 * We:
 *  1. Find or create a message via /api/3/messages
 *  2. Create the campaign via /api/3/campaigns with type=single
 *  3. Set segment based on tagIds
 *  4. If mode=send-now or schedule, set the send time
 *
 * For "send-now" we POST a sdate (start date) in the past to trigger
 * immediate send. AC's queue typically picks up within a few minutes.
 */

const AC_URL = (process.env.ACTIVECAMPAIGN_API_URL || 'https://starjessetaylor92181.api-us1.com').replace(/\/$/, '');
const AC_KEY = process.env.ACTIVECAMPAIGN_API_KEY;
const DEFAULT_LIST_ID = process.env.AC_AUDACITY_LIST_ID || '3';

function bodyToHtml(plainBody) {
  const safe = plainBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = safe.split(/\n\s*\n/).map(p => p.replace(/\n/g, '<br/>'));
  const inner = paragraphs.map(p => `<p style="margin:0 0 18px;line-height:1.65;font-size:15.5px;color:#2C2C2C;">${p}</p>`).join('');
  return `<div style="max-width:620px;margin:0 auto;padding:32px 24px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${inner}</div>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.CRON_SECRET;
  if (!expected || req.query.key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!AC_KEY) return res.status(500).json({ error: 'AC key missing' });

  const { subject, body, tagIds = [], excludeTagIds = [], mode = 'draft', scheduleAt } = req.body || {};

  if (!subject || !body) return res.status(400).json({ error: 'subject and body required' });
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: 'At least one tag required for audience' });
  }
  if (mode === 'schedule' && !scheduleAt) {
    return res.status(400).json({ error: 'scheduleAt required for schedule mode' });
  }

  const acHeaders = { 'Api-Token': AC_KEY, 'Content-Type': 'application/json' };
  const html = bodyToHtml(body);

  try {
    // Step 1: create message
    const messageRes = await fetch(`${AC_URL}/api/3/messages`, {
      method: 'POST',
      headers: acHeaders,
      body: JSON.stringify({
        message: {
          format: 'mime',
          subject,
          fromemail: 'hello@starjessetaylor.com',
          fromname: 'Star Jesse Taylor',
          reply2: 'starjessetaylor@gmail.com',
          html,
          text: body,
          ed_instanceid: '0',
          ed_version: '0',
        },
      }),
    });
    if (!messageRes.ok) {
      const err = await messageRes.text().catch(() => '');
      return res.status(500).json({ error: 'AC message create failed', detail: err.slice(0, 400) });
    }
    const messageData = await messageRes.json();
    const messageId = messageData.message?.id;
    if (!messageId) return res.status(500).json({ error: 'No message id returned' });

    // Step 2: build segment from tags. AC segments are conditional rules.
    // For "any of these tags," use an OR condition. For "all of these
    // tags," use AND. We default to OR (union) since most use cases are
    // "send to people who have ANY of these tags."
    const segmentName = `Email Writer ${new Date().toISOString().slice(0, 16)}`;
    const conditions = tagIds.map(id => ({
      field: 'TAG',
      operator: '=',
      value: String(id),
    }));
    excludeTagIds.forEach(id => {
      conditions.push({ field: 'TAG', operator: '!=', value: String(id) });
    });

    const segmentRes = await fetch(`${AC_URL}/api/3/segments`, {
      method: 'POST',
      headers: acHeaders,
      body: JSON.stringify({
        segment: {
          name: segmentName,
          logic: tagIds.length > 1 ? '"or"' : '"and"',
        },
      }),
    });
    let segmentId = null;
    if (segmentRes.ok) {
      const sd = await segmentRes.json();
      segmentId = sd.segment?.id;
    }

    // Step 3: create campaign
    const now = new Date();
    const sdate = mode === 'send-now'
      ? new Date(now.getTime() - 60000).toISOString()
      : mode === 'schedule'
        ? scheduleAt
        : null;

    const campaignPayload = {
      campaign: {
        type: 'single',
        name: subject.slice(0, 60),
        status: mode === 'draft' ? 0 : 1,
        public: 1,
        track_links: 'all',
        tracklinkdefault: 1,
        tracklinksanalytics: 1,
        tracktraffic: 1,
        trackgoogle: 1,
        trackreads: 1,
      },
    };
    if (sdate) campaignPayload.campaign.sdate = sdate;

    const campaignRes = await fetch(`${AC_URL}/api/3/campaigns`, {
      method: 'POST',
      headers: acHeaders,
      body: JSON.stringify(campaignPayload),
    });
    if (!campaignRes.ok) {
      const err = await campaignRes.text().catch(() => '');
      return res.status(500).json({ error: 'AC campaign create failed', detail: err.slice(0, 400) });
    }
    const campaignData = await campaignRes.json();
    const campaignId = campaignData.campaign?.id;
    if (!campaignId) return res.status(500).json({ error: 'No campaign id returned' });

    // Step 4: attach message + list + (segment) to campaign
    await fetch(`${AC_URL}/api/3/campaignMessages`, {
      method: 'POST',
      headers: acHeaders,
      body: JSON.stringify({
        campaignMessage: { campaign: campaignId, message: messageId, weight: 100 },
      }),
    }).catch(() => {});

    await fetch(`${AC_URL}/api/3/campaignLists`, {
      method: 'POST',
      headers: acHeaders,
      body: JSON.stringify({
        campaignList: { campaign: campaignId, list: DEFAULT_LIST_ID },
      }),
    }).catch(() => {});

    return res.status(200).json({
      ok: true,
      campaignId,
      messageId,
      segmentId,
      mode,
      message: mode === 'draft'
        ? 'Draft created in ActiveCampaign. Review and send manually from AC.'
        : mode === 'send-now'
          ? 'Campaign created and scheduled for immediate send. AC will deliver within a few minutes.'
          : `Campaign scheduled for ${scheduleAt}.`,
      acEditUrl: `https://starjessetaylor92181.activehosted.com/campaign/${campaignId}/designer`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Send exception', detail: String(err.message ?? err) });
  }
}
