# Rules for Claude in this project

Working notes for any Claude session in this repo. Short on purpose — read
top to bottom on session start.

---

## How to talk to me

Joshua isn't a coder. Explanations should land in plain English, the same
way the app's user copy is meant to (see "Voice in code" below). That means:

- Avoid implementation jargon (refcount, idempotent, race condition, cache
  invalidation, hoist, payload, dispatcher) unless it's load-bearing for
  the decision. If a term is unavoidable, gloss it in one short clause.
- Describe what changed and why, not how the code is structured. Cause and
  effect beats abstract description.
- When offering options, write them in everyday language. Don't surface
  branching strategies, merge models, or other tool mechanics as a choice
  menu — make the call and explain it.
- Long technical detail is fine when the user asks for it. The default is
  short and clear.

---

## After pushing a build, always state the build ID

Every time a push lands on `main` (which triggers the GitHub Pages deploy),
include the short build identifier in the reply — the same one that shows
under **Settings → About** on the device. Joshua compares it against the
deployed app to confirm "yes, this is the build I just pushed" when
testing from a phone or iPad.

Format: just quote it, e.g. _"Pushed. Build `ab465d5` is on its way to the
live URL."_ No need to spell out git terminology.

---

## Voice in code (user-visible strings)

The Playbook section 11 ("Voice and copy") is the source of truth. The
short version:

- Every user-visible string is read by a student, not a developer.
- Avoid implementation jargon (chip, propagate, cascade, sibling, endpoint,
  idempotent, refcount), coding terms (kebab-case, schema, regex), and
  internal scheduling references (Session N).
- Describe results, not mechanisms.
- The Playbook has a swap table of bad → good patterns — match those.

This applies to user-visible strings only. Code-side identifiers
(`pronunciationLanguage`, `variant="primary"`, table columns, type names)
stay in their existing technical conventions.

---

## Rejected ideas live in `DESIGN-DECISIONS.md`

Before re-suggesting a refactor or feature shape, skim that file. If the
trade-off has genuinely changed (new data scale, new requirement), update
the existing entry rather than starting over.

---

## Self-review after each session

Don't build on bad code. Run a rigorous review pass before declaring a
piece of work done — past sessions have caught real shippable bugs
(storeMedia refCount leak, audio safety-timer race, MCQ preview gap) only
because of this discipline. Same expectation going forward.

---

## Where to look for context

| File | What's in it |
|---|---|
| `SESSION-LOG.md` | Current status, what's next, resume-on-new-machine guide, architectural invariants, bug-pattern reminders |
| `FantasticFlashcards-Playbook.md` | Full spec: data model, design system, voice + copy rules, every feature's contract |
| `FantasticFlashcards-BuildPlan.md` | Original 16-session brief; historical, useful for architectural rationale |
| `QA-CHECKLIST.md` | Live retest items + deferred polish list |
| `DESIGN-DECISIONS.md` | Rejected ideas with rationale |
| `README.md` | End-user / contributor front door |

Read `SESSION-LOG.md` first when resuming on a new machine or in a new
session — it's the single-file catch-up brief.
