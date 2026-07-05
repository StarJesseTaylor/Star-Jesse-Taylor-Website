// Sticky top Skool banner. Injects on every page EXCEPT /coaching.
// Locked with Star Jul 5 2026:
//   Copy = "One free week of live calls with Star."
//   Big obvious button so users see where to click.

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
      position: sticky; top: 0; z-index: 9999;
      background: linear-gradient(90deg, #FBF3E5 0%, #F5D9BE 100%);
      color: #0D2C4F;
      font-family: 'Inter', system-ui, sans-serif;
      border-bottom: 1px solid rgba(13, 44, 79, 0.15);
      display: flex; align-items: center; justify-content: center; gap: 20px;
      padding: 10px 44px 10px 20px;
      box-shadow: 0 2px 8px rgba(13, 44, 79, 0.08);
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
      font-size: 0.9rem;
      font-weight: 900;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      padding: 10px 22px;
      border-radius: 100px;
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 12px rgba(13, 44, 79, 0.25);
      white-space: nowrap;
    }
    #skool-banner-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(13, 44, 79, 0.35);
      background: #1E5A9E;
    }
    #skool-banner-close {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: #0D2C4F;
      font-size: 1.4rem; font-weight: 700; cursor: pointer;
      padding: 4px 10px; line-height: 1; opacity: 0.55;
      transition: opacity 0.15s;
    }
    #skool-banner-close:hover { opacity: 1; }
    @media (max-width: 720px) {
      #skool-banner {
        flex-direction: column; gap: 8px; padding: 12px 36px 12px 14px;
      }
      #skool-banner-message { font-size: 0.88rem; text-align: center; line-height: 1.35; }
      #skool-banner-btn { font-size: 0.82rem; padding: 8px 18px; }
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
