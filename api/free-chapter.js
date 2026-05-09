// Free chapter offer retired 2026-05-07.
// Endpoint kept as a stub that returns 410 Gone so any old form
// or automation hitting it does not silently succeed.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  console.log('Free chapter endpoint hit (offer retired):', {
    method: req.method,
    referer: req.headers.referer || 'none',
    body: req.body || {}
  });

  return res.status(410).json({
    error: 'This offer has ended',
    redirect: '/quiz.html'
  });
}
