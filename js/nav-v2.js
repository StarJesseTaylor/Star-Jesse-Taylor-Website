// New dropdown nav v2. Replaces existing nav on every page.
// Locked with Star Jul 5 2026:
//   Home | About | Live Calls with Star (primary) | Work With Star ▾ | Ask Star | Courses | Book
//   Dropdown: 1-on-1 Coaching | Group Program | Cohort | Workshops
// Rule: never use "coaching" for the community/live-calls offering. That word
// is RESERVED for the 1-on-1 offering only (see feedback_coaching_word_reserved).

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
          <li class="nav-item-primary"><a href="/community">Live Calls with Star</a></li>
          <li class="nav-dropdown" data-nav-dropdown>
            <button class="nav-dropdown-toggle" type="button" aria-expanded="false">
              Work With Star <span class="nav-dropdown-caret">▾</span>
            </button>
            <ul class="nav-dropdown-menu" role="menu">
              <li><a href="/coaching" role="menuitem">1-on-1 Coaching</a></li>
              <li><a href="/cohort" role="menuitem">Group Program</a></li>
              <li><a href="/cohort" role="menuitem">Cohort</a></li>
              <li><a href="/event" role="menuitem">Workshops</a></li>
            </ul>
          </li>
          <li><a href="/ask-star">Ask Star</a></li>
          <li><a href="/courses">Courses</a></li>
          <li><a href="/book">Book</a></li>
        </ul>
        <a href="/community" class="btn btn-primary btn-sm nav-cta">7 Days Free</a>
        <button class="nav-hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="nav-mobile">
        <ul class="nav-mobile-links">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li class="nav-item-primary"><a href="/community">Live Calls with Star</a></li>
          <li class="nav-mobile-group">
            <div class="nav-mobile-group-label">Work With Star</div>
            <ul>
              <li><a href="/coaching">1-on-1 Coaching</a></li>
              <li><a href="/cohort">Group Program</a></li>
              <li><a href="/cohort">Cohort</a></li>
              <li><a href="/event">Workshops</a></li>
            </ul>
          </li>
          <li><a href="/ask-star">Ask Star</a></li>
          <li><a href="/courses">Courses</a></li>
          <li><a href="/book">Book</a></li>
          <li class="nav-mobile-cta">
            <a href="/community" class="btn btn-primary">7 Days Free · Live Calls with Star</a>
          </li>
        </ul>
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
      z-index: 1002;
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
    .nav-item-primary a { color: #C97552 !important; font-weight: 800 !important; }
    /* Mobile menu overlay */
    .nav-mobile {
      display: none;
      position: fixed; top: 68px; left: 0; right: 0; bottom: 0;
      background: #fff; z-index: 999;
      overflow-y: auto; padding: 20px 24px 40px;
    }
    body.has-skool-banner .nav-mobile { top: calc(68px + 44px); }
    @media (max-width: 720px) {
      body.has-skool-banner .nav-mobile { top: calc(68px + 40px); }
    }
    .nav-mobile.open { display: block; }
    .nav-mobile-links { list-style: none; padding: 0; margin: 0; }
    .nav-mobile-links > li { padding: 14px 4px; border-bottom: 1px solid rgba(0,0,0,0.08); }
    .nav-mobile-links > li > a {
      display: block; color: #0D2C4F; text-decoration: none;
      font-size: 1.15rem; font-weight: 700; padding: 4px 0;
    }
    .nav-mobile-links > li.nav-item-primary > a { color: #C97552; }
    .nav-mobile-group-label {
      font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em;
      color: rgba(13, 44, 79, 0.5); font-weight: 800; margin-bottom: 8px;
    }
    .nav-mobile-group ul { list-style: none; padding: 0; margin: 4px 0 0 12px; }
    .nav-mobile-group ul li { padding: 8px 0; }
    .nav-mobile-group ul li a {
      color: #0D2C4F; text-decoration: none; font-size: 1rem; font-weight: 600;
    }
    .nav-mobile-cta { text-align: center; padding-top: 20px !important; }
    .nav-mobile-cta .btn { display: inline-block; width: auto; padding: 14px 22px !important; }
    @media (min-width: 901px) {
      .nav-mobile { display: none !important; }
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

    const hamburger = oldNav.querySelector('.nav-hamburger');
    const mobileMenu = oldNav.querySelector('.nav-mobile');
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle('open');
        const spans = hamburger.querySelectorAll('span');
        if (mobileMenu.classList.contains('open')) {
          spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
          spans[1].style.opacity = '0';
          spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
          spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        }
      });
      mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          mobileMenu.classList.remove('open');
          hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
