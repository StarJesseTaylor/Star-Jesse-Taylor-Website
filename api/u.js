// Star approved button and confirmation. GET never unsubscribes:
// scanners and link previews must not change a member's preferences.
import { alphaRpc, tokenHash, validToken } from './reminders/_alpha.js';
const page = content => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Star Taylor SMS preferences</title><style>body{font:18px system-ui;max-width:32rem;margin:12vh auto;padding:24px;line-height:1.5}button{font:inherit;padding:14px 22px;cursor:pointer}</style><main>${content}</main></html>`;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).send(page('<p>Method not allowed.</p>')); }
  const token = req.query?.t;
  if (!validToken(token)) return res.status(400).send(page('<p>This unsubscribe link is invalid. Please use the link in your text message.</p>'));
  if (req.method === 'GET') return res.status(200).send(page('<form method="post"><button type="submit">Stop my text reminders</button></form>'));
  // The unguessable token is the scoped bearer capability. No cookies, login or PII.
  try {
    const stopped = await alphaRpc('unsubscribe_sms_token', { p_hash: tokenHash(token) });
    if (stopped !== true) return res.status(400).send(page('<p>This unsubscribe link is invalid. Please use the link in your text message.</p>'));
    return res.status(200).send(page('<h1>Your SMS reminders are stopped.</h1>'));
  } catch {
    return res.status(503).send(page('<h1>We could not save that yet.</h1><p>Please try again. Your unsubscribe request has not been confirmed.</p><form method="post"><button type="submit">Try again</button></form>'));
  }
}
