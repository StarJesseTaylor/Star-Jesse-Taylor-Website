// Sticky top Skool banner. Injects on every page EXCEPT /coaching.
// Locked with Star Jul 5 2026.
//
// CORRECT LAYOUT (this fixes both Jul 5 mobile bugs at once):
//   Banner: position:fixed, top:0, z-index:1001, ~44px height
//   Nav: pushed down by banner height via JS (top:44px)
//   Body: extra padding-top so hero content doesn't hide under both
// This way BOTH banner and nav stay visible at top, banner sits ABOVE
// nav (never covers hamburger), and clicking hamburger works normally.

(function() {
  const EXCLUDED_PATHS = ['/coaching', '/coaching.html'];
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
  if (EXCLUDED_PATHS.some(p => path.endsWith(p))) return;

  const DISMISSED_KEY = 'skool-banner-dismissed';
  const DISMISS_DAYS = 7;
  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (dismissed) {
    const elapsed = Date.now() - parseInt(dismissed, 10);
    if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
  }

  const BANNER_HEIGHT = 44;   // desktop
  const BANNER_HEIGHT_MOBILE = 40;

  const css = `
    #skool-banner {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 1001;
      height: ${BANNER_HEIGHT}px;
      background: linear-gradient(90deg, #1E5A9E 0%, #0D2C4F 100%);
      color: #FFFFFF;
      font-family: 'Inter', system-ui, sans-serif;
      border-bottom: 2px solid #F2D5A6;
      display: flex; align-items: center; justify-content: center; gap: 16px;
      padding: 0 44px 0 16px;
    }
    #skool-banner-message {
      font-size: 0.94rem; font-weight: 700;
      letter-spacing: -0.01em;
      color: #FFFFFF;
    }
    #skool-banner-btn {
      display: inline-block !important;
      background: #FFD447 !important;
      color: #0D2C4F !important;
      font-family: inherit;
      font-size: 0.86rem !important;
      font-weight: 900 !important;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 7px 18px !important;
      border-radius: 100px !important;
      border: 2px solid #FFFFFF !important;
      text-decoration: none !important;
      transition: background 0.15s, transform 0.15s;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    #skool-banner-btn:hover { background: #FFE070 !important; transform: translateY(-1px); }
    #skool-banner-close {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: #FFFFFF;
      font-size: 1.3rem; font-weight: 700; cursor: pointer;
      padding: 4px 10px; line-height: 1; opacity: 0.7;
    }
    #skool-banner-close:hover { opacity: 1; }
    /* Push down the fixed nav so the banner isn't hidden behind it */
    body.has-skool-banner nav.nav { top: ${BANNER_HEIGHT}px !important; }
    body.has-skool-banner { padding-top: ${BANNER_HEIGHT}px; }
    @media (max-width: 720px) {
      #skool-banner {
        height: ${BANNER_HEIGHT_MOBILE}px;
        gap: 8px; padding: 0 34px 0 10px;
      }
      #skool-banner-message { font-size: 0.75rem; }
      #skool-banner-btn { font-size: 0.68rem; padding: 6px 10px; }
      body.has-skool-banner nav.nav { top: ${BANNER_HEIGHT_MOBILE}px !important; }
      body.has-skool-banner { padding-top: ${BANNER_HEIGHT_MOBILE}px; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'skool-banner';
  banner.innerHTML = `
    <span id="skool-banner-message">One free week of live calls with Star.</span>
    <a href="/community" id="skool-banner-btn">Try It Free →</a>
    <button id="skool-banner-close" aria-label="Dismiss">×</button>
  `;
  document.body.insertBefore(banner, document.body.firstChild);
  document.body.classList.add('has-skool-banner');

  document.getElementById('skool-banner-close').addEventListener('click', () => {
    banner.style.display = 'none';
    document.body.classList.remove('has-skool-banner');
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  });
})();
