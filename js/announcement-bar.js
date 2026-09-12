/**
 * Star Jesse Taylor · Sticky announcement bar
 *
 * Re-enabled June 27, 2026 for the July 1 community launch.
 * Loads on every page that includes this script (21 pages). Shows a slim
 * top bar with a live countdown to July 1, linking to the waitlist. On
 * July 1 it flips itself to "open" and points at the Skool join link.
 *
 * To retire after launch: replace the body of the IIFE with a no-op again.
 */

(function () {
  'use strict';

  var LAUNCH = new Date('2026-07-01T00:00:00-07:00').getTime(); // July 1, 2026, Pacific
  var WAITLIST_URL = 'community.html';
  var OPEN_URL = 'community.html'; // redirects to the Skool community

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var bar = document.createElement('a');
  bar.id = 'sjt-announce-bar';
  bar.href = WAITLIST_URL;
  bar.setAttribute('aria-label', 'Join the community. Weekly live coaching calls with Star.');
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:1001',
    'display:flex', 'align-items:center', 'justify-content:center',
    'gap:14px', 'flex-wrap:wrap',
    'background:linear-gradient(90deg,#0a1929,#0d2540)', 'color:#fff',
    "font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif",
    'font-size:0.9rem', 'font-weight:700', 'padding:9px 16px',
    'text-decoration:none', 'box-shadow:0 2px 14px rgba(0,0,0,0.18)', 'line-height:1.3'
  ].join(';');

  bar.innerHTML =
    '<span class="sjt-bar-lead" style="color:#f5d478;font-weight:900;letter-spacing:0.03em;">Weekly live coaching calls with Star</span>' +
    '<span class="sjt-bar-cta" style="color:#fff;font-weight:800;">Join the Community &rarr;</span>';

  function offset() {
    var h = bar.offsetHeight;
    var nav = document.querySelector('.nav');
    if (nav) nav.style.top = h + 'px';
    document.body.style.paddingTop = h + 'px';
  }

  // Countdown code removed 2026-07-08 per Star. Freebie copy removed
  // 2026-09-10 per Star (no freebies). Banner now shows the static
  // "Weekly live coaching calls with Star" copy, pointing at the Skool
  // community. No countdown, no launch flip.
  function tick() {
    // No-op. Banner content is static.
    return;
    // Silence unused-vars warnings from the surrounding code below.
    void pad;
  }

  function init() {
    document.body.insertBefore(bar, document.body.firstChild);
    offset();
    tick();
    setInterval(tick, 1000);
    window.addEventListener('resize', offset);
    window.addEventListener('load', offset);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
