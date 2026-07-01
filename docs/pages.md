# HTML Pages Inventory

~40 hand-written `.html` pages at the repo root, plus `admin/` and `preview/`. Clean routes come from `vercel.json` `rewrites`; pages without a rewrite are served by filename. Each page's form (if any) POSTs JSON to a same-origin `/api/*` function.

## Core marketing
| File | Route | Purpose | Form → API |
|---|---|---|---|
| `index.html` | `/` | Homepage; hero + SMS opt-in | `/api/sms-optin` |
| `about.html` | `/about` | Star's story/background | — |
| `services.html` | `/services` | "Work With Star" menu (group, workshops, intensives, cohort) | `/api/cohort-waitlist` (`#waitlistForm`) |
| `book.html` | `/book` | The Emotional Fitness book; buy + free-chapter offer | (Stripe via `/api/book-checkout`) |
| `courses.html` | `/courses` | Self-paced course catalog | — |

## Sales / offer
| File | Route | Purpose | Form → API |
|---|---|---|---|
| `event.html` | `/event` | LA workshop page + live seat counter | `/api/event-waitlist`, GET `/api/event-seats` |
| `virtual-events.html` | `/virtual-events` | "Ask Star Directly" paid voice-memo Q&A | — |
| `speak.html` | `/speak` | Speaking inquiry | `/api/speaking-inquiry` |
| `tour.html` | `/tour` | Multi-city workshop tour interest | `/api/tour-interest` |
| `cohort.html` | `/cohort` | 10-week cohort waitlist | `/api/cohort-waitlist` |
| `la-meetup.html` | `/la-meetup` | Monthly LA meetup | `/api/la-meetup-waitlist` |

## Lead-capture / funnel
| File | Route | Purpose | Form → API |
|---|---|---|---|
| `quiz.html` | `/quiz` | Main qualification quiz | `/api/quiz-submit` |
| `qualify.html` | `/qualify` | "Find your path" recommendation | `/api/qualify` |
| `apply.html` | `/apply` | General coaching application | `/api/coaching-application` (via `js/main.js#applicationForm`) |
| `apply-package.html` | (filename) | 6/10-week package application | `/api/coaching-application` |
| `apply-tester.html` | `/apply-tester` | Audacity beta-tester signup | `/api/audacity-tester-apply` |
| `letter.html` | `/letter` | Star's Letters newsletter | `/api/join-letter` |
| `whats-next.html` | `/whats-next` | Community/waitlist combined interest | `/api/whats-next` |
| `app.html` | `/app` | Audacity app landing + waitlist | `/api/audacity-waitlist` |
| `workshop-welcome.html` | `/workshop-welcome` | Post-purchase LA-workshop questionnaire (noindex) | `/api/workshop-questionnaire` |

## Course-delivery "secret URL" pages
Each paid course has a public marketing page **and** a private, unguessable-slug access page (all `noindex`). Stripe payment-link redirects point buyers to the access page (see `STRIPE_REDIRECT_URLS.txt`).

| Marketing page | Route | Access page (direct URL only) |
|---|---|---|
| `breakthrough-blueprint.html` | `/breakthrough-blueprint` | `breakthrough-blueprint-access-9k7m2vxp.html` |
| `healthy-relationship.html` | `/healthy-relationship` | `healthy-relationship-access-3p8x7m9k.html` |
| `self-worth-course.html` | `/self-worth-course` | `self-worth-access-5w8k3qn7.html` |

## Thank-you / confirmation
| File | Route | Purpose |
|---|---|---|
| `thank-you.html` | `/thank-you` | Redirect stub → `/quiz.html` |
| `event-thank-you.html` | `/event-thank-you` | "Seat reserved" for LA event (noindex) |
| `book-thank-you.html` | `/book-thank-you` | Book-purchase confirmation + upsell |
| `free-chapter.html` | (filename) | Redirect stub → `/quiz.html` (offer retired) |

## App-preview (design mockups, noindex)
| File | Notes |
|---|---|
| `app-preview.html` | Current Santorini palette preview |
| `app-preview-old.html` | ⚠️ backup, old palette |
| `app-preview-compare.html` | side-by-side comparison |
| `preview/garden.html` (`/preview/garden`) | Audacity "garden" screen preview |

## Admin (noindex, gated by `?key=<CRON_SECRET>`)
| File | Route | Back end |
|---|---|---|
| `admin/testers.html` | `/testers` | `/api/admin/testers-list`, `/api/admin/testers-update` |
| `admin/dashboard.html` | (filename) | `/api/admin/dashboard` |
| `admin/email-writer.html` | `/email-writer` | `/api/email-writer/*` |
| `admin/relationships.html` | `/relationships` | `/api/admin/star-relationships` |
| `admin/audit-bots.html` | (filename) | `/api/admin/audit-bot-signups` |

## Community / experimental
| File | Route | Purpose |
|---|---|---|
| `community.html` | `/community` | Redirects to the Skool community (July 1 launch) |
| `slideshow-brain-algorithm.html` | `/slideshow` | Swipeable launch deck → Skool (noindex) |
| `youtube-agent.html` | (filename) | Private YouTube-strategy tool → `/api/yt-agent` (noindex) |

## Legal
| File | Route |
|---|---|
| `privacy.html` | `/privacy` |
| `terms.html` | `/terms` |

## Loose ends / backups to clean up
- `index.html.backup-before-declutter` — a committed backup copy of the homepage.
- `app-preview-old.html`, `app-preview-compare.html` — palette-comparison scratch files.
- `Usersstarjac_tags_full.json`, `Usersstarjac_segments_sets.json` — AC export dumps sitting at repo root (odd filenames; untracked).
- `remote-control-test.txt` — a 2-line test file at root.
- `SETUP.md` (EmailJS/Netlify) and `claude-handoff.md` (May 4) are both **out of date** — kept for history, don't trust as current.
