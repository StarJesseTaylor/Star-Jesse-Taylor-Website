# Front End (`js/`, `css/`)

No bundler, no framework. Scripts are included via plain `<script src>` tags. Not every page loads every file.

## Typical per-page script stack
- `js/tracking.js` (async, head) — pixels + `window.starTrack`
- `js/announcement-bar.js` (defer, head) — July 1 countdown bar
- `js/posthog-init.js` (head) — PostHog analytics (most universal; even on thank-you/admin)
- `js/main.js` + `js/chat-widget.js` (before `</body>`) — shared behaviors + Star AI widget (marketing/funnel pages only)

`app.html` loads `js/nav.js` instead of `main.js`; `cohort.html`, `whats-next.html`, `letter.html`, and most `*-access-*.html` pages skip `main.js`/`chat-widget.js`.

## `js/main.js`
Shared site behaviors, each guarded by `if (el)` so it's a no-op when the element is absent:
- Injects a shared `<datalist id="countries">` for signup autocomplete.
- Nav scroll shadow, mobile hamburger, close-on-link-click.
- `IntersectionObserver` fade-up animations, FAQ accordion, `[data-count]` stat counters, smooth anchor scroll (90px offset).

Form handlers it owns:
- `#applicationForm` (in `apply.html`) → honeypot check → `POST /api/coaching-application`. **On failure it does NOT fake success** — re-enables the button and alerts the user to email Star. If the `$2,200` cohort option is chosen it also pings `/api/cohort-waitlist`.
- `#waitlistForm` (real form in `services.html`) → `POST /api/cohort-waitlist` then `window.starTrack('cohort_waitlist_signup')`. Shows success regardless of API result.
- `#emailCaptureForm` → `/api/free-chapter` (retired). **Dead code** — no matching HTML exists.
- `#intensiveWaitlist` / `#intensiveWaitlistServices` → legacy `emailjs.send(...)` with a `mailto:` fallback. **Dead code** — no matching HTML, and no EmailJS is loaded.

## `js/chat-widget.js` — "Star AI"
Self-contained floating chat bubble + slide-up panel, injects its own `<style>` and DOM (`.sai-*` classes, cobalt→turquoise theme). Conversation history in `sessionStorage` (`starAI_history`, cap 30). `POST /api/chat` with `{messages}`, expects `{reply}`. Bot replies are parsed for `[CTA:key]` → hardcoded CTA buttons and `[TESTIMONIAL:key]` → hardcoded YouTube-Shorts testimonial cards.

⚠️ **Disabled by a kill switch:** the IIFE starts with `const ENABLED = false; if (!ENABLED) return;`. So even though ~15 pages load it, it renders **nothing** and `/api/chat` is never called until Star flips the flag. This is the single biggest dormant feature.

## `js/announcement-bar.js`
Fixed top bar counting down to **July 1 2026** community launch (re-enabled Jun 27). Builds an `<a id="sjt-announce-bar">`, offsets `.nav`/`body`. At zero it self-flips copy to "The community is open / Join now" and repoints from `whats-next.html` to `community.html`. **Today (2026-07-01) it's at/entering the "open" state.** Comment says to retire it post-launch by no-op'ing the IIFE.

## `js/tracking.js`
Multi-pixel loader + unified `window.starTrack(event, params)`. A `PIXELS` map; `isReal()` skips any ID starting with the `YOUR_` placeholder prefix (unconfigured platforms make no requests).
- **Live:** Meta Pixel, TikTok Pixel (real public IDs committed).
- **Placeholder only:** Google Ads, LinkedIn, Pinterest, Twitter/X.
`starTrack` fans one event out to every connected platform (each wrapped in try/catch). Called from `main.js` and inline page scripts (e.g. `quiz.html` fires `quiz_completed`).

## `js/posthog-init.js`
PostHog bootstrap (shared project with the Audacity app for end-to-end funnels; shipped Jun 25). `person_profiles:'identified_only'`, autocapture + pageviews + pageleave + session replay. Exposes `window.starPosthogIdentify(email, props)`. Public project key is committed (safe client-side).
- ⚠️ Docstring claims `coaching_application` and `quiz_completed` fire as PostHog captures; in code only `whats_next_signup` is actually `posthog.capture`'d (others go through `starTrack` pixels).

## `css/styles.css`
Single global stylesheet, **1,688 lines**, `/* ===== SECTION ===== */` banners, no preprocessor. Design tokens in `:root`:
- `--cobalt #1B6CA8`, `--cobalt-dark #155a8a`, `--turquoise #00B4D8`, `--turquoise-light #90E0EF`, `--charcoal #2C2C2C`, plus off-white/grays, `--font-sans` (Inter), `--font-serif` (Georgia), `--nav-height 76px`, `--radius 12px`, shadows, `--transition`.
- Uses `clamp()` fluid type + utility classes (`.container`, `.section-pad`).
- The same palette is **re-hardcoded inline** in `chat-widget.js` and `announcement-bar.js` (they don't read the CSS vars).

## Dominant form-submission pattern
Two coexist, **inline per-page scripts dominate**:
1. **Inline `<script>`** in the page: `preventDefault` → build JSON from `FormData` → `fetch('/api/…', {method:'POST', ...})` → swap in a success message. Used by most funnel pages (`whats-next`, `quiz`, `app`, `apply-package`, `cohort`, `letter`, `la-meetup`, `speak`, `tour`, `qualify`, `event`, `index`, admin pages, `youtube-agent`).
2. **Centralized in `js/main.js`** for a few named forms (`#applicationForm`, `#waitlistForm`, and the two dead ones).

Most forms include a `website_url` honeypot and **degrade gracefully (show success even if the fetch fails)** — except the coaching application, which surfaces errors.
