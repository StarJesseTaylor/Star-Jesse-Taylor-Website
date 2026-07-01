# Strategy & Business Context

The "why" behind the code. Read this alongside `docs/state-and-todos.md` so any task can be weighed against where the business is going, not just what the code does.

**Owner:** Star Jesse Taylor. **Last updated:** 2026-07-01. Update this whenever the funnel, pricing, goals, or positioning change.

## Positioning (non-negotiable brand guardrails)
- Star is an **emotional fitness coach**, not a therapist.
- **Do not reduce people to a single framework.** The brand is breadth, not one model.
- Teach staying **"on track"** and **building momentum**.
- **Avoid clinical / treatment language** (no diagnosis, no "cure/fix/treat/recover," no symptom-as-illness framing). External positioning is wellness, not mental health.
- Voice rules that already govern copy: consequence-of-pain hooks, no em-dashes, no salesy overclaims, only verified testimonials and offer terms. Keep marketing copy in Star's voice; Star drives framework content, code scaffolds it.

## The funnel (offer ladder, top to bottom)
1. **Free content** on Instagram, TikTok, YouTube. Awareness and audience.
2. **$29 book funnel** — paid tripwire that feeds the top of the funnel. Repo: `book.html`, `book-thank-you.html`, `/api/book-checkout`, `/api/book-webhook`.
3. **$49/month Skool community ("Audacity")** — the front door and core recurring revenue. Weekly live calls. **Launched July 1 2026.** Repo touchpoints: `community.html`, `whats-next.html`, `/api/whats-next`, `/api/whats-next-digest`, `js/announcement-bar.js`.
4. **Paid online workshop** — the "money-qualifier" that separates buyers from browsers. Repo: `event.html`, `virtual-events.html`, `/api/event-waitlist`.
5. **$2,200 cohort, by application.** Repo: `apply.html`, `apply-package.html`, `cohort.html`, `/api/coaching-application`, `/api/cohort-waitlist`.
6. **1-on-1 coaching.** Highest touch, top of the ladder.

**Possible future tier:** inner circle around **$149/month** (maybe higher).

The whole system only works if each stage hands off to the next: a book buyer nurtured toward the community, a community member toward the workshop, a workshop buyer toward the cohort. Any stage that captures money or attention but does not route people onward is a leak.

## Channels
- **YouTube = the primary long-term growth engine.** Long-form is the compounding bet.
- **Instagram + TikTok** = top-of-funnel reach and social proof.

## Goals
| Goal | Target |
|---|---|
| YouTube subscribers | ~25k → **100k** → **1M** → **4M** |
| Skool community MRR | **$50k–$100k/month** at $49 (~1,020–2,040 paying members) |
| Inner-circle tier | optional, ~$149+/month |
| In-person | more workshops like LA, building toward large seminars (thousands in a room) and workshops worldwide |

## Product leverage: "build once, deploy three"
The long-term product is a library of step-by-step **pathways** (overthinking, anxiety, procrastination, and so on). Each pathway ships to **three surfaces from one source**:
1. A **community course** (Skool).
2. A **guided flow** in the app.
3. An **email sequence**.

Author the teaching once, deploy it three ways. This is the central content leverage of the business. When we build content tooling, bias toward a single source of truth that can render to all three, not three separate builds.

## Operating agreement for this working window
1. Build and fix code using the full documentation in `CLAUDE.md` + `docs/`.
2. For every task, consider how it fits this funnel and these goals, and flag anything that works against the strategy.
3. Honest pushback over blind execution.
4. Keep `CLAUDE.md`, `docs/`, and this file current; prompt Star to update when something significant changes.

## Open strategic flags (to resolve with Star)
- **Community brand name.** Star refers to the $49 community as "Audacity," but `community.html` and `slideshow-brain-algorithm.html` currently redirect to `skool.com/the-brain-algorithm`, and "Audacity" has been the app's name. Confirm the intended brand for community vs app so the funnel reads coherently.
- **Book funnel may be leaking at the entrance.** The newly built `/api/book-webhook` has unverified AC tagging (wrong env-var names) and PDF delivery (`BOOK_PDF_URL` fallback is a page, not a file). Details in `docs/state-and-todos.md`. A leak here wastes every dollar spent driving book sales.
- **No unified funnel measurement.** The $50k–$100k/month goal needs a visible denominator: of N book buyers, how many enter the community, then the workshop, then the cohort. Today that path is spread across ActiveCampaign tags and PostHog with no single view.
