/**
 * Book download proxy — buyer-authenticated PDF delivery.
 *
 * Buyer clicks the link in their email:
 *   https://starjessetaylor.com/api/book-download?session_id=cs_test_xxx
 *
 * We verify with Stripe that this session was actually paid, then fetch the
 * book PDF from the private Vercel Blob store (using our token) and stream
 * it to the buyer. No one without a real Stripe session ID can access the PDF.
 *
 * Env vars:
 *   STRIPE_SECRET_KEY — to verify the session
 *   BLOB_READ_WRITE_TOKEN — to fetch from the private Blob store
 *   BOOK_BLOB_PATHNAME — the blob path (default: "EMOTIONAL FITNESS BOOK PDF")
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export const config = {
  api: {
    responseLimit: false, // allow streaming responses larger than the default 4.5MB
  },
};

export default async function handler(req, res) {
  const { session_id } = req.query;

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).send('Missing session_id');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const pathname = process.env.BOOK_BLOB_PATHNAME || 'emotional-fitness-book.pdf';

  if (!stripeKey || !blobToken) {
    console.error('Missing env: stripe=', !!stripeKey, 'blob=', !!blobToken);
    return res.status(500).send('Download not configured');
  }

  // Step 1: verify the Stripe session was paid
  let stripeSession;
  try {
    const stripeRes = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(session_id)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    });
    stripeSession = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('Stripe session lookup failed:', stripeSession);
      return res.status(403).send('Invalid session');
    }
  } catch (err) {
    console.error('Stripe verification error:', err);
    return res.status(500).send('Verification failed');
  }

  if (stripeSession.payment_status !== 'paid') {
    return res.status(403).send('Payment not completed');
  }

  // Step 2: fetch the PDF from Vercel Blob using our token
  //
  // Vercel Blob's private URLs require the read-write token via Bearer auth,
  // or use the head() endpoint to get a short-lived signed URL. We use the
  // simpler direct-fetch pattern here since we already have the token.
  //
  // The Blob store URL pattern: https://{storeId}.private.blob.vercel-storage.com/{pathname}
  // We extract the storeId from the token's JWT payload OR use the public API endpoint.
  //
  // Simpler: use the Vercel Blob API to get metadata + downloadUrl
  const blobApiUrl = `https://blob.vercel-storage.com/${encodeURIComponent(pathname)}`;

  let blobRes;
  try {
    blobRes = await fetch(blobApiUrl, {
      headers: { Authorization: `Bearer ${blobToken}` }
    });
  } catch (err) {
    console.error('Blob fetch error:', err);
    return res.status(500).send('Could not retrieve book');
  }

  if (!blobRes.ok) {
    const errText = await blobRes.text();
    console.error('Blob returned non-200:', blobRes.status, errText.slice(0, 300));
    return res.status(502).send('Book file not available. Please email support.');
  }

  // Step 3: stream the PDF to the buyer
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Emotional-Fitness-by-Star-Taylor.pdf"');
  const contentLength = blobRes.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  // Node.js stream the body through
  if (blobRes.body) {
    const reader = blobRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    return res.end();
  }

  // Fallback: buffer + send
  const buffer = Buffer.from(await blobRes.arrayBuffer());
  return res.status(200).send(buffer);
}
