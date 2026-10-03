/**
 * Star Jesse Taylor · Sticky announcement bar
 *
 * Loads on every page that includes this script (21 pages). Slim top bar.
 *
 * Oct 2 2026: date-aware. UNTIL Nov 14 2026 it promotes the in-person LA
 * workshop and links to /la-workshop. On/after Nov 14 it automatically
 * reverts to the evergreen "Weekly live coaching calls" bar pointing at the
 * Skool community. No manual switch needed.
 */

(function () {
  'use strict';

  var WORKSHOP = new Date('2026-11-14T23:59:00-08:00').getTime(); // LA workshop day (Pacific)
  var now = Date.now();
  var workshopMode = now < WORKSHOP;

  var HREF, LEAD, CTA, GRAD;
  if (workshopMode) {
    HREF = '/la-workshop';
    LEAD = 'LA WORKSHOP &middot; SATURDAY NOV 14';
    CTA  = 'In person in Los Angeles. Reserve your spot &rarr;';
    GRAD = 'linear-gradient(90deg,#0a1929,#0d2540)';
  } else {
    HREF = 'community.html';
    LEAD = 'Weekly live coaching calls with Star';
    CTA  = 'Join the Community &rarr;';
    GRAD = 'linear-gradient(90deg,#0a1929,#0d2540)';
  }

  var bar = document.createElement('a');
  bar.id = 'sjt-announce-bar';
  bar.href = HREF;
  bar.setAttribute('aria-label', workshopMode
    ? 'LA Workshop, Saturday November 14, in person in Los Angeles. Reserve your spot.'
    : 'Join the community. Weekly live coaching calls with Star.');
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:1001',
    'display:flex', 'align-items:center', 'justify-content:center',
    'gap:14px', 'flex-wrap:wrap',
    'background:' + GRAD, 'color:#fff',
    "font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif",
    'font-size:0.9rem', 'font-weight:700', 'padding:9px 16px',
    'text-decoration:none', 'box-shadow:0 2px 14px rgba(0,0,0,0.18)', 'line-height:1.3'
  ].join(';');

  bar.innerHTML =
    '<span class="sjt-bar-lead" style="color:#f5d478;font-weight:900;letter-spacing:0.03em;">' + LEAD + '</span>' +
    '<span class="sjt-bar-cta" style="color:#fff;font-weight:800;">' + CTA + '</span>';

  function offset() {
    var h = bar.offsetHeight;
    var nav = document.querySelector('.nav');
    if (nav) nav.style.top = h + 'px';
    document.body.style.paddingTop = h + 'px';
  }

  function init() {
    document.body.insertBefore(bar, document.body.firstChild);
    offset();
    window.addEventListener('resize', offset);
    window.addEventListener('load', offset);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
