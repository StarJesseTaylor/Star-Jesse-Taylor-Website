# Photo Inventory

What lives in each folder, what it's for, and how to reference it from HTML.

Last updated: 2026-06-24

---

## Active folders

### `Beach Meditation Shoot/`
**What:** Beach meditation footage shoot. NEW June 2026.
**Vibe:** Calm, ocean, golden hour, presence.
**Use for:** Hero photos on /whats-next, future meditation pages, Skool pre-launch seed.
**Status:** Star uploading.

### `Beach Coaching Shoot/`
**What:** Beach coaching footage shoot. NEW June 2026.
**Vibe:** Open conversation, ocean backdrop, real talk.
**Use for:** Hero photos on coaching pages, About page, Skool pre-launch seed.
**Status:** Star uploading.

### `LA Beach Meetup Weekly/`
**What:** Ongoing weekly LA beach meetup photos. Star runs this Saturdays (probably).
**Vibe:** Community, in-person, locals showing up.
**Use for:** Skool community feed (NOT public website without Star approval per locked rule).
**Status:** Empty, ready for weekly dumps starting when meetup begins.

### `Urban Lights Shoot/`
**What:** Cinematic LA night portrait shoot.
**Vibe:** LA at night, neon lights, polished.
**Use for:** Hero portraits. Currently used on event.html ("Star portrait" cinematic divider) and /whats-next.
**Referenced files:** `DSC00880.JPG`, `DSC00934.JPG`

### `Pictures of Star/`
**What:** Mixed portraits and headshots, various sources.
**Vibe:** Varies.
**Use for:** General purpose Star photos when no specific shoot fits.
**Referenced from HTML:** yes (4 references).

### `Star LA Background/`
**What:** LA-themed background images for hero sections.
**Vibe:** Background-friendly, low-detail focal point.
**Use for:** Section backgrounds, blurred hero overlays.
**Referenced from HTML:** yes (`Best.png` used).

### `Client Pictures/`
**What:** Photos of featured 1-on-1 clients.
**Files:** Amy, Anabelle1, Anabelle2, Carl, Lara, Lara2, Nesreen 1, Nesreen 3.
**Use for:** Testimonial sections with photo + quote.
**Referenced from HTML:** yes (Anabelle1, Anabelle2, Carl, Lara, Nesreen 1).

### `Atmosphere Pictures for the Website/`
**What:** Single atmospheric photo (IMG_1574).
**Use for:** Section backgrounds, mood-setting visuals.
**Status:** Sparse, may consolidate into another folder later.

### `Algorithm Slides/`
**What:** The 8 brain algorithm teaching slides Star uses on stage.
**Use for:** Workshop sales pages, IG content, future course pages.
**Renamed from `Algorithm Sllides` (typo) on 2026-06-24.**

### `Testimonials/`
**What:** Older testimonial graphics. Verify content before using.
**Status:** Audit needed.

### `Colors for the website/`
**What:** Brand color reference swatches.
**Use for:** Design reference only, not page content.

### `From Star/`
**What:** Staging folder for new uploads from Star's iPhone before sorting.
**Workflow:** Star drops new photos here, I move them to the right shoot folder.

### `book-cover.PNG`
**What:** Book #1 cover image. Used on book.html and breakthrough-blueprint.html.

---

## How to reference from HTML

Folder names contain spaces. Use URL-encoded paths in `src` attributes:

```html
<!-- WRONG -->
<img src="images/Beach Meditation Shoot/photo.jpg" />

<!-- RIGHT -->
<img src="images/Beach%20Meditation%20Shoot/photo.jpg" />
```

The browser handles both, but URL-encoded is the safe pattern matching the rest of the codebase.

---

## Naming convention going forward

For each new shoot, create a new folder named: `{Subject} {Shoot Type}/`

Examples:
- `Beach Meditation Shoot/`
- `LA Coaching Shoot/`
- `Studio Headshots Aug 2026/`

For ongoing weekly content, use `{Subject} Weekly/`:
- `LA Beach Meetup Weekly/`

Always create one folder per shoot or content stream. Keeps vibe matching simple when picking a photo for a page.

---

## Cleanup later (not blocking now)

These folders have inconsistent names but are referenced in live HTML. Renaming requires updating every HTML reference in the same commit.

| Current name | Suggested rename | HTML refs |
|---|---|---|
| `Pictures of Star/` | `Star Portraits Mixed/` | 4 |
| `Star LA Background/` | `LA Backgrounds/` | 1 |
| `Client Pictures/` | `Client Portraits/` | 5 |
| `Atmosphere Pictures for the Website/` | `Atmosphere/` | 0 (safe to rename anytime) |

Total touchpoints: ~10 HTML edits across event.html, index.html, services.html, cohort.html, about.html. Park as a separate cleanup pass.
