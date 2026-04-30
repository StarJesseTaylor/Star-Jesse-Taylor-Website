/**
 * Star Jesse Taylor · Sticky announcement bar
 *
 * Fixed-position bar at the very top of every page promoting the
 * LA Intensive on May 30, 2026. Includes a live countdown, dismiss
 * button (sessionStorage so it returns next visit), Meta + TikTok
 * AnnouncementBarClick custom event firing, and mobile-responsive layout.
 *
 * To change the event, edit EVENT_DATE, EVENT_URL, and the labels below.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'announcementBarDismissed';
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1') return;

  var EVENT_DATE = new Date('2026-05-30T13:30:00-07:00');
  var EVENT_URL = '/event.html';
  var BAR_HEIGHT_DESKTOP = 42;
  var BAR_HEIGHT_MOBILE = 36;

  function daysUntilEvent() {
    var diff = EVENT_DATE.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  function injectStyles() {
    if (document.getElementById('sjt-ann-bar-style')) return;
    var css = ''
      + '.sjt-ann-bar{position:fixed;top:0;left:0;right:0;z-index:1000;'
      + 'background:#111;color:#fff;padding:10px 44px 10px 16px;'
      + 'text-align:center;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
      + 'font-size:14px;font-weight:500;letter-spacing:0.01em;line-height:1.4;'
      + 'text-decoration:none;display:block;cursor:pointer;'
      + 'transition:background .18s ease;'
      + 'box-shadow:0 1px 0 rgba(255,255,255,0.04);}'
      + '.sjt-ann-bar:hover{background:#1f1f1f;}'
      + '.sjt-ann-bar:visited,.sjt-ann-bar:link{color:#fff;}'
      + '.sjt-ann-text{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;}'
      + '.sjt-ann-cta{font-weight:700;text-decoration:underline;text-underline-offset:3px;}'
      + '.sjt-ann-dot{opacity:0.55;}'
      + '.sjt-ann-flame{font-size:1em;}'
      + '.sjt-ann-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);'
      + 'background:transparent;border:0;color:#fff;font-size:20px;line-height:1;'
      + 'cursor:pointer;padding:4px 10px;opacity:0.65;font-family:inherit;'
      + 'transition:opacity .15s ease;}'
      + '.sjt-ann-close:hover{opacity:1;}'
      + 'body.sjt-ann-bar-on{padding-top:' + BAR_HEIGHT_DESKTOP + 'px;}'
      + 'body.sjt-ann-bar-on .nav{top:' + BAR_HEIGHT_DESKTOP + 'px;}'
      + '@media (max-width:640px){'
      + '.sjt-ann-bar{font-size:12px;padding:8px 36px 8px 10px;}'
      + '.sjt-ann-d,.sjt-ann-date,.sjt-ann-spots{display:none;}'
      + 'body.sjt-ann-bar-on{padding-top:' + BAR_HEIGHT_MOBILE + 'px;}'
      + 'body.sjt-ann-bar-on .nav{top:' + BAR_HEIGHT_MOBILE + 'px;}'
      + '}';
    var s = document.createElement('style');
    s.id = 'sjt-ann-bar-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildBar() {
    var days = daysUntilEvent();
    var daysText = days === 0 ? 'Today' : (days === 1 ? '1 day left' : days + ' days left');

    var bar = document.createElement('a');
    bar.href = EVENT_URL;
    bar.className = 'sjt-ann-bar';
    bar.setAttribute('data-sjt-ann', 'la-intensive-may-30-2026');

    bar.innerHTML =
        '<span class="sjt-ann-text">'
      +   '<span class="sjt-ann-flame">🔥</span>'
      +   '<span class="sjt-ann-main">LA Intensive</span>'
      +   '<span class="sjt-ann-dot sjt-ann-d">·</span>'
      +   '<span class="sjt-ann-date">May 30, 2026</span>'
      +   '<span class="sjt-ann-dot sjt-ann-d">·</span>'
      +   '<span class="sjt-ann-spots">Only 30 Spots</span>'
      +   '<span class="sjt-ann-dot sjt-ann-d">·</span>'
      +   '<span class="sjt-ann-countdown">' + daysText + '</span>'
      +   '<span class="sjt-ann-dot">·</span>'
      +   '<span class="sjt-ann-cta">Reserve Yours →</span>'
      + '</span>'
      + '<button class="sjt-ann-close" aria-label="Dismiss announcement" type="button">×</button>';

    bar.addEventListener('click', function (e) {
      var target = e.target;
      if (target && target.classList && target.classList.contains('sjt-ann-close')) {
        e.preventDefault();
        e.stopPropagation();
        try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) {}
        bar.parentNode && bar.parentNode.removeChild(bar);
        document.body.classList.remove('sjt-ann-bar-on');
        return;
      }

      // Fire custom event for Meta + TikTok via the central tracker
      if (window.starTrack) {
        try {
          window.starTrack('AnnouncementBarClick', {
            content_name: 'LA Intensive May 30 2026',
            content_category: 'announcement_bar',
            event_url: EVENT_URL,
            days_until_event: days
          });
        } catch (err) {}
      } else {
        // Fallback: fire raw fbq + ttq calls in case starTrack helper failed to load
        try { if (window.fbq) window.fbq('trackCustom', 'AnnouncementBarClick', { content_name: 'LA Intensive May 30 2026' }); } catch (err) {}
        try { if (window.ttq) window.ttq.track('AnnouncementBarClick', { content_name: 'LA Intensive May 30 2026' }); } catch (err) {}
      }
      // Native link navigation continues, no preventDefault
    });

    return bar;
  }

  function init() {
    injectStyles();
    var bar = buildBar();
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('sjt-ann-bar-on');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
