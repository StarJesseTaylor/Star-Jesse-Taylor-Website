# The Cohort — archived offer record

**Status: not selling. Taken off the live site Aug 3 2026.**

There is no workshop or cohort scheduled right now. This file exists so the offer is
not lost and can be relaunched exactly as it was, without anyone having to
reconstruct it from memory.

- Live URL behaviour: `/cohort` and `/cohort.html` → **307 temporary** redirect to `/community`.
  Temporary on purpose, so bringing the page back does not fight cached browser redirects.
- The sales page itself is still in the repo, untouched: **`cohort.html`**.
- The waitlist API is still deployed and functional: **`api/cohort-waitlist.js`**.
- Because the page redirects, **the waitlist form is currently unreachable.** Nobody can
  join. That is the one thing to be aware of, since the waitlist used to be always-on.

---

## The offer (verified terms)

Source: `cohort.html` as shipped, plus Star's decision of Jun 22 2026.

| | |
|---|---|
| **Length** | 6 weeks |
| **Size** | 12 seats |
| **Investment** | $2,200 paid in full, or 3 payments of $797 |
| **Cadence** | 3 to 4 per year. Waitlist always open; waitlist gets first call. |

### Positioning (page copy, verbatim)

> **Six weeks. Twelve people. One framework that works.**
>
> For people stuck in anxiety, intrusive thoughts, OCD, or reactive patterns they cannot
> break alone. The cohort is when you stop reading about it and actually install it.

Supporting lines under each fact:

- **Length** — "Long enough for real change. Short enough to have an end you can see."
- **Size** — "Small enough that Star knows your story by the second week."
- **Investment** — "Paid in full or three payments of $797. Pay once, the framework is yours forever."
- **Cadence** — "Waitlist is always open. When the next cohort opens, the waitlist gets first call."

### What is included (page copy, verbatim)

1. **Weekly 90-minute live group call with Star.** Same time every week for six weeks. Star
   teaches the framework piece for that week and applies it to whatever is showing up for
   the people in the room. Recordings available for the cohort only.
2. **Private cohort channel inside Star's community.** Just you and the eleven other people
   doing the work with you. Ask questions between calls. Post your wins and the spots you
   got stuck. Star is in there.
3. **Accountability partner.** Paired with one other cohort member at week one. Check in
   with each other between calls.
4. **Personal practice plan.** By week three you have your own version of the framework.
   Which reframes are yours. Which actions are yours. What you do in the moment when the
   loop tries to come back.
5. **Graduation into Inner Circle.** Cohort graduates are invited into Inner Circle, the
   alumni-only community where Star shows up weekly.

### Who it is for (page copy, verbatim)

- You have anxiety, intrusive thoughts, OCD-style compulsions, or reactive patterns that
  have been running you. You know what you want and you keep not doing it.
- Therapy gave you names for what is happening but did not give you the framework to
  actually break it. You are ready for something that works.
- You can commit to one ninety-minute call per week for six weeks. You can put your
  accountability partner first when they need it. You can show up to the room.
- You are done collecting frameworks and ready to install one.

### Proof used on the page

- **Justina**, workshop attendee — written testimonial ("It was so transformative for me.
  I unlocked something I have been struggling with for years.")
- **Katie Hayman**, 1-on-1 coaching client — video, YouTube ID `KJcgDLzLTgo`

### What happened when a cohort opened

1. Email the waitlist first, with a 48-hour early-access window.
2. Then Inner Circle plus workshop alumni.
3. Then the public list and social.
4. Cap at 12 seats. Sold out closes that cohort; the waitlist stays open for the next.

---

## Waitlist plumbing (still live)

`api/cohort-waitlist.js` — captures first name, last name, email, country, optional phone.

- ActiveCampaign list **3** (Master Contact List)
- Tags applied: `path:cohort`, `cohort:waitlist`, `source:website`, plus `country:<X>`,
  plus `sms:opted-in` when a phone is given
- Confirmation email to the signup from `hello@starjessetaylor.com` via Resend
- Notification email to `starjessetaylor@gmail.com` on every signup
- Honeypot field `website_url` plus a gibberish-name bot filter

Anyone already tagged `cohort:waitlist` in ActiveCampaign is the existing waitlist. That
audience did not disappear when the page came down.

---

## Two things to fix before relaunching

**1. The confirmation email describes a different offer than the page.**
`api/cohort-waitlist.js` tells people the cohort is **10 weeks** and includes **one private
1-on-1 session**. The page and Star's Jun 22 decision say **6 weeks, 12 seats**, with no
1-on-1 session included. Everyone who joined the waitlist received the 10-week version.
Decide which is real and make the page, the email, and this file agree.

**2. The page copy uses "container" twice**, which is on the banned-words list
("The container where the transformation actually happens", "The container that keeps you
from drifting back"). Worth a voice pass before it goes live again.

---

## To bring it back

1. In `vercel.json`, delete the four `/cohort` and `/cohort.html` entries from `redirects`.
   The `/cohort` rewrite is already present in `rewrites`, so the page serves immediately.
2. Fix the confirmation-email mismatch above.
3. Add `cohort.html` back to `sitemap.xml`.
4. Optionally re-add a Cohort link to the nav or footer. The nav is copy-pasted per page,
   so copy the block from `index.html` rather than editing one page.
5. Push. Vercel redeploys on push to `main`.
