// New dropdown nav v2. Replaces the existing <nav.nav> block on every page.
// Structure locked with Star Jul 5 2026:
//   Home | About | Community | Work With Star (dropdown) | Ask Star | Courses | Book
// Dropdown: 1-on-1 Coaching | Group Coaching | Cohort | Workshops

(function() {
  const NAV_HTML = `
    <div class="container">
      <div class="nav-inner">
        <a href="/" class="nav-logo">
          <span class="nav-logo-name">Star Jesse Taylor</span>
          <span class="nav-logo-sub">Emotional Fitness</span>
        </a>
        <ul class="nav-links" id="nav-links-v2">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li class="nav-item-primary"><a href="/community">Community</a></li>
          <li class="nav-dropdown" data-nav-dropdown>
            <button class="nav-dropdown-toggle" type="button" aria-expanded="false">
              Work With Star <span class="nav-dropdown-caret">▾</span>
            </button>
            <ul class="nav-dropdown-menu" role="menu">
              <li><a href="/coaching" role="menuitem">1-on-1 Coaching</a></li>
              <li><a href="/cohort" role="menuitem">Group Coaching</a></li>
              <li><a href="/cohort" role="menuitem">Cohort</a></li>
              <li><a href="/event" role="menuitem">Workshops</a></li>
            </ul>
          </li>
          <li><a href="/ask-star">Ask Star</a></li>
          <li><a href="/courses">Courses</a></li>
          <li><a href="/book">Book</a></li>
        </ul>
        <a href="/community" class="btn btn-primary btn-sm nav-cta">Try Community · 7 Days Free</a>
        <button class="nav-hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  `;

  const NAV_CSS = `
    .nav-dropdown { position: relative; }
    .nav-dropdown-toggle {
      background: transparent; border: none; cursor: pointer;
      font-family: inherit; font-size: inherit; color: inherit; font-weight: inherit;
      padding: 0; display: inline-flex; align-items: center; gap: 4px;
    }
    .nav-dropdown-caret { font-size: 0.75em; opacity: 0.7; transition: transform 0.2s; }
    .nav-dropdown[data-open="true"] .nav-dropdown-caret { transform: rotate(180deg); }
    .nav-dropdown-menu {
      position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      background: #fff; border: 1px solid rgba(0,0,0,0.08);
      border-radius: 10px; padding: 8px 0; margin: 8px 0 0;
      list-style: none; min-width: 190px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12);
      opacity: 0; visibility: hidden; transition: opacity 0.15s, visibility 0.15s;
      z-index: 100;
    }
    .nav-dropdown[data-open="true"] .nav-dropdown-menu,
    .nav-dropdown:hover .nav-dropdown-menu {
      opacity: 1; visibility: visible;
    }
    .nav-dropdown-menu li { padding: 0; margin: 0; }
    .nav-dropdown-menu a {
      display: block; padding: 10px 20px;
      color: #0D2C4F; text-decoration: none; font-size: 0.94rem; font-weight: 600;
      white-space: nowrap; transition: background 0.12s;
    }
    .nav-dropdown-menu a:hover { background: rgba(13, 44, 79, 0.06); }
    .nav-item-primary a {
      color: #C97552 !important; font-weight: 800 !important;
    }
    @media (max-width: 900px) {
      .nav-dropdown-menu {
        position: static; transform: none; box-shadow: none;
        margin: 4px 0 8px 12px; padding: 4px 0;
        border: none; border-left: 2px solid rgba(0,0,0,0.1);
        border-radius: 0; background: transparent; min-width: 0;
        opacity: 1; visibility: visible;
        display: none;
      }
      .nav-dropdown[data-open="true"] .nav-dropdown-menu { display: block; }
      .nav-dropdown-toggle { padding: 8px 0; width: 100%; text-align: left; justify-content: flex-start; }
    }
  `;

  function init() {
    const oldNav = document.querySelector('nav.nav');
    if (!oldNav) return;
    const style = document.createElement('style');
    style.textContent = NAV_CSS;
    document.head.appendChild(style);
    oldNav.innerHTML = NAV_HTML;
    const dropdowns = oldNav.querySelectorAll('[data-nav-dropdown]');
    dropdowns.forEach(dd => {
      const toggle = dd.querySelector('.nav-dropdown-toggle');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dd.getAttribute('data-open') === 'true';
        dd.setAttribute('data-open', String(!isOpen));
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });
    });
    document.addEventListener('click', () => {
      dropdowns.forEach(dd => {
        dd.setAttribute('data-open', 'false');
        const t = dd.querySelector('.nav-dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
