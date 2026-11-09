/**
 * Star Jesse Taylor · Sticky announcement bar
 *
 * Loads on every page that includes this script (21 pages). Slim top bar.
 *
 * Nov 8 2026: the cancelled Nov 14 workshop promotion was removed. The bar
 * now promotes the waitlist for the next in-person LA workshop (January 2027)
 * and links to /la-workshop.
 */

(function () {
  'use strict';

  var HREF = '/la-workshop';
  var LEAD = 'LA WORKSHOP &middot; JANUARY 2027';
  var CTA  = 'In person in Los Angeles. Join the waitlist &rarr;';
  var GRAD = 'linear-gradient(90deg,#0a1929,#0d2540)';

  var bar = document.createElement('a');
  bar.id = 'sjt-announce-bar';
  bar.href = HREF;
  bar.setAttribute('aria-label', 'LA Workshop, January 2027, in person in Los Angeles. Join the waitlist.');
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
