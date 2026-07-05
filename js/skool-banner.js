// Sticky top Skool banner. Injects on every page EXCEPT /coaching.
// FIXED Jul 5 2026: banner was BLOCKING the fixed nav hamburger on mobile.
// Solution: banner is now RELATIVE (not sticky/fixed), sits at very top of
// document flow. Nav (position:fixed) still works exactly as before. Users
// see banner on page load, then it scrolls away — same UX as most sites'
// promo bars. Simple, robust, no z-index war.

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

  const css = `
    #skool-banner {
      position: relative; z-index: 998;
      background: linear-gradient(90deg, #FBF3E5 0%, #F5D9BE 100%);
      color: #0D2C4F;
      font-family: 'Inter', system-ui, sans-serif;
      border-bottom: 1px solid rgba(13, 44, 79, 0.15);
      display: flex; align-items: center; justify-content: center; gap: 20px;
      padding: 10px 44px 10px 20px;
    }
    #skool-banner-message {
      font-size: 0.98rem; font-weight: 700;
      letter-spacing: -0.01em;
    }
    #skool-banner-btn {
      display: inline-block;
      background: #0D2C4F;
      color: #FBF3E5;
      font-family: inherit;
      font-size: 0.88rem;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 9px 20px;
      border-radius: 100px;
      text-decoration: none;
      transition: transform 0.15s, background 0.15s;
      white-space: nowrap;
    }
    #skool-banner-btn:hover {
      transform: translateY(-1px);
      background: #1E5A9E;
    }
    #skool-banner-close {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: #0D2C4F;
      font-size: 1.3rem; font-weight: 700; cursor: pointer;
      padding: 4px 10px; line-height: 1; opacity: 0.55;
    }
    #skool-banner-close:hover { opacity: 1; }
    @media (max-width: 720px) {
      #skool-banner {
        gap: 10px; padding: 9px 32px 9px 12px;
      }
      #skool-banner-message { font-size: 0.82rem; }
      #skool-banner-btn { font-size: 0.72rem; padding: 7px 12px; }
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

  document.getElementById('skool-banner-close').addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  });
})();
