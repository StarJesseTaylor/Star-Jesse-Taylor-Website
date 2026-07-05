// Sticky top Skool banner. Injects on every page EXCEPT /coaching (per Star's rule:
// protect 1:1 intent, no downsell). Dismissible via X, hides for 7 days.

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
      padding: 12px 44px 12px 20px;
      font-size: 0.94rem; font-weight: 600;
      text-align: center;
      box-shadow: 0 2px 8px rgba(13, 44, 79, 0.08);
    }
    #skool-banner a {
      color: #0D2C4F;
      font-weight: 900;
      text-decoration: none;
      border-bottom: 2px solid #C97552;
      padding-bottom: 2px;
      transition: color 0.15s;
    }
    #skool-banner a:hover { color: #C97552; }
    #skool-banner-close {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; color: #0D2C4F;
      font-size: 1.4rem; font-weight: 700; cursor: pointer;
      padding: 4px 10px; line-height: 1; opacity: 0.6;
      transition: opacity 0.15s;
    }
    #skool-banner-close:hover { opacity: 1; }
    @media (max-width: 640px) {
      #skool-banner { font-size: 0.85rem; padding: 10px 40px 10px 14px; gap: 10px; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'skool-banner';
  banner.innerHTML = `
    <span>Weekly live calls with Star. <a href="/community">7 days free →</a></span>
    <button id="skool-banner-close" aria-label="Dismiss">×</button>
  `;
  document.body.insertBefore(banner, document.body.firstChild);

  document.getElementById('skool-banner-close').addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  });
})();
