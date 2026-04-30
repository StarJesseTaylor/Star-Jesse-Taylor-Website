// Source tracking.
//
// Captures a source tag from the URL on first landing (e.g. ?from=ig, ?source=tt,
// ?utm_source=instagram), persists it in localStorage for 7 days, and appends it
// as client_reference_id to any Stripe Buy Now link the visitor clicks. The
// /api/stripe-webhook handler reads client_reference_id and applies the matching
// "Source: X" tag in ActiveCampaign.
//
// Drop in via <script src="js/source-tracking.js"></script>. No other setup needed.

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var STORAGE_KEY = 'sjt_source';
  var TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
  var MAX_LEN = 40;

  function sanitize(value) {
    if (!value) return null;
    var v = String(value).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (!v) return null;
    return v.slice(0, MAX_LEN);
  }

  function readUrlSource() {
    try {
      var params = new URLSearchParams(window.location.search);
      return (
        sanitize(params.get('from')) ||
        sanitize(params.get('source')) ||
        sanitize(params.get('utm_source'))
      );
    } catch (e) {
      return null;
    }
  }

  function getStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.value) return null;
      if (Date.now() - obj.t > TTL_MS) return null;
      return obj.value;
    } catch (e) {
      return null;
    }
  }

  function setStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: value, t: Date.now() }));
    } catch (e) {}
  }

  // 1. Capture on page load. URL beats stored value so the most recent click wins.
  var fromUrl = readUrlSource();
  if (fromUrl) setStored(fromUrl);

  // 2. On click of any Stripe Buy link, append client_reference_id if not already set.
  document.addEventListener(
    'click',
    function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href*="buy.stripe.com"]') : null;
      if (!link) return;

      var source = getStored();
      if (!source) return;

      try {
        var url = new URL(link.href);
        if (!url.searchParams.has('client_reference_id')) {
          url.searchParams.set('client_reference_id', source);
          link.href = url.toString();
        }
      } catch (err) {
        // If URL parsing fails, leave the link as is.
      }
    },
    true
  );
})();
