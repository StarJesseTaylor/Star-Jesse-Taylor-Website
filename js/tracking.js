/**
 * Star Jesse Taylor · Site-wide tracking pixels
 *
 * To activate any pixel, replace the placeholder ID with the real one.
 * Empty / placeholder IDs are skipped automatically (no errors, no requests).
 *
 * Once IDs are set here, tracking takes effect on every page that loads this script.
 */

(function () {
  'use strict';

  var PIXELS = {
    meta:     '1385602039742216',       // Star Jesse Taylor Meta Pixel (Facebook + Instagram)
    tiktok:   'D7PGC4BC77U9KU0AH660', // Star Jesse Taylor TikTok Pixel
    googleAds:'YOUR_GOOGLE_ADS_ID',     // e.g. 'AW-1234567890'     (covers Google + YouTube)
    linkedin: 'YOUR_LINKEDIN_PARTNER_ID',// e.g. '1234567'
    pinterest:'YOUR_PINTEREST_TAG_ID',  // e.g. '2612345678901'
    twitter:  'YOUR_TWITTER_PIXEL_ID'   // e.g. 'o1abc'
  };

  var PLACEHOLDER_PREFIX = 'YOUR_';
  function isReal(id) {
    return id && typeof id === 'string' && id.indexOf(PLACEHOLDER_PREFIX) !== 0;
  }

  // Meta Pixel (Facebook + Instagram)
  if (isReal(PIXELS.meta)) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXELS.meta);
    window.fbq('track', 'PageView');
  }

  // TikTok Pixel
  if (isReal(PIXELS.tiktok)) {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e };
      ttq.load = function (e, n) { var r = 'https://analytics.tiktok.com/i18n/pixel/events.js', o = n && n.partner;
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        n = document.createElement('script'); n.type = 'text/javascript'; n.async = !0; n.src = r + '?sdkid=' + e + '&lib=' + t;
        e = document.getElementsByTagName('script')[0]; e.parentNode.insertBefore(n, e)
      };
      ttq.load(PIXELS.tiktok);
      ttq.page();
    }(window, document, 'ttq');
  }

  // Google Ads (covers Google Search + Display + YouTube)
  // Reuses gtag from GA4 if already present; otherwise loads it.
  if (isReal(PIXELS.googleAds)) {
    if (typeof window.gtag === 'undefined') {
      var s = document.createElement('script'); s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + PIXELS.googleAds;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
    }
    window.gtag('config', PIXELS.googleAds);
  }

  // LinkedIn Insight Tag
  if (isReal(PIXELS.linkedin)) {
    window._linkedin_partner_id = PIXELS.linkedin;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(PIXELS.linkedin);
    (function(l) { if (!l) { window.lintrk = function(a,b) { window.lintrk.q.push([a,b]); }; window.lintrk.q = []; }
      var s = document.getElementsByTagName('script')[0]; var b = document.createElement('script');
      b.type = 'text/javascript'; b.async = true; b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      s.parentNode.insertBefore(b, s); })(window.lintrk);
  }

  // Pinterest Tag
  if (isReal(PIXELS.pinterest)) {
    !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
      var n=window.pintrk;n.queue=[],n.version='3.0';var t=document.createElement('script');t.async=!0,t.src=e;
      var r=document.getElementsByTagName('script')[0];r.parentNode.insertBefore(t,r)}}('https://s.pinimg.com/ct/core.js');
    window.pintrk('load', PIXELS.pinterest);
    window.pintrk('page');
  }

  // X / Twitter Pixel
  if (isReal(PIXELS.twitter)) {
    !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments)},
      s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
      a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
    window.twq('config', PIXELS.twitter);
  }

  // Standard Meta event names. These get fired with fbq('track',...) so they
  // appear as standard events in Meta Ads Manager. Anything else is sent
  // through fbq('trackCustom',...).
  var META_STANDARD_EVENTS = {
    PageView: 1, ViewContent: 1, Search: 1, AddToCart: 1, AddToWishlist: 1,
    InitiateCheckout: 1, AddPaymentInfo: 1, Purchase: 1, Lead: 1,
    CompleteRegistration: 1, Contact: 1, Schedule: 1, Subscribe: 1, StartTrial: 1
  };

  // Helper for site code to fire conversion events on every connected platform at once.
  // Usage:
  //   window.starTrack('Lead', { content_name: 'quiz_complete' })
  //   window.starTrack('InitiateCheckout', { value: 97, currency: 'USD', content_name: 'LA Event GA' })
  //   window.starTrack('Purchase', { value: 347, currency: 'USD', content_name: 'LA Event VIP' })
  window.starTrack = function (eventName, params) {
    params = params || {};
    try {
      if (window.fbq && isReal(PIXELS.meta)) {
        var fbqMethod = META_STANDARD_EVENTS[eventName] ? 'track' : 'trackCustom';
        window.fbq(fbqMethod, eventName, params);
      }
    } catch (e) {}
    try { if (window.ttq && isReal(PIXELS.tiktok)) window.ttq.track(eventName, params); } catch (e) {}
    try { if (window.gtag) window.gtag('event', eventName, params); } catch (e) {}
    try { if (window.lintrk && isReal(PIXELS.linkedin)) window.lintrk('track', { conversion_id: params.linkedin_conversion_id }); } catch (e) {}
    try { if (window.pintrk && isReal(PIXELS.pinterest)) window.pintrk('track', eventName, params); } catch (e) {}
    try { if (window.twq && isReal(PIXELS.twitter)) window.twq('event', eventName, params); } catch (e) {}
  };
})();
