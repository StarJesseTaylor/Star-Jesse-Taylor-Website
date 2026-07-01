/**
 * Book download proxy — buyer-authenticated PDF delivery.
 *
 * Buyer clicks the link in their email:
 *   https://starjessetaylor.com/api/book-download?session_id=cs_test_xxx
 *
 * We verify with Stripe that this session was actually paid, then fetch the
 * book PDF from the private Vercel Blob store (using our BLOB_READ_WRITE_TOKEN)
 * and stream it back to the buyer. Only real paid sessions can trigger this.
 *
 * Vercel Blob private URL pattern:
 *   https://{storeHash}.private.blob.vercel-storage.com/{pathname}
 *   with Authorization: Bearer {BLOB_READ_WRITE_TOKEN}
 *
 * Env vars:
 *   STRIPE_SECRET_KEY — to verify the session
 *   BLOB_READ_WRITE_TOKEN — auto-added when the Blob store was connected
 *   BOOK_BLOB_STORE_HASH — the private store hash (extractable from the store URL)
 *     defaults to 'xilphdnwuyepatjj' which is Star's BOOKSTORAGE store
 *   BOOK_BLOB_PATHNAME — the file's pathname in the store
 *     defaults to 'EMOTIONAL FITNESS BOOK PDF'
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export const config = {
  api: {
    responseLimit: false, // allow streaming large PDFs past the default 4.5MB
  },
};

export default async function handler(req, res) {
  const { session_id } = req.query;

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).send('Missing session_id');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const storeHash = process.env.BOOK_BLOB_STORE_HASH || 'xilphdnwuyepatjj';
  const pathname = process.env.BOOK_BLOB_PATHNAME || 'EMOTIONAL FITNESS BOOK PDF';

  if (!stripeKey || !blobToken) {
    console.error('Missing env: stripe=', !!stripeKey, 'blob=', !!blobToken);
    return res.status(500).send('Download not configured');
  }

  // Step 1: verify the Stripe session was actually paid
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

  // Step 2: fetch the PDF directly from the private Blob store using our token.
  //
  // Private Blob URLs are addressable via {storeHash}.private.blob.vercel-storage.com
  // The BLOB_READ_WRITE_TOKEN in the Authorization header authenticates us as
  // the store owner and grants read access to any blob in the store.
  const blobUrl = `https://${storeHash}.private.blob.vercel-storage.com/${encodeURIComponent(pathname)}`;

  let blobRes;
  try {
    blobRes = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${blobToken}` }
    });
  } catch (err) {
    console.error('Blob fetch error:', err);
    return res.status(500).send('Could not retrieve book');
  }

  if (!blobRes.ok) {
    const errText = await blobRes.text().catch(() => '(no body)');
    console.error('Blob returned non-200:', blobRes.status, errText.slice(0, 300), 'for URL:', blobUrl);
    return res.status(502).send('Book file not available. Please email star@starjessetaylor.com for help.');
  }

  // Step 3: stream the PDF to the buyer
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Emotional-Fitness-by-Star-Taylor.pdf"');
  const contentLength = blobRes.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  // Stream the body chunk-by-chunk to avoid buffering the whole 80+MB file in memory
  if (blobRes.body) {
    const reader = blobRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    return res.end();
  }

  // Fallback if streaming isn't available for some reason
  const buffer = Buffer.from(await blobRes.arrayBuffer());
  return res.status(200).send(buffer);
}
