# Frame Brief: Profile urgency marker (S-09, FR-019)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

FR-019 (`context/foundation/prd.md:88`) says: "User can see on the profile list the urgency of each
profile (colour of its most urgent medication)." The sidebar today shows only a red dot, on profiles
with a red or ran-out medication (`src/components/app-shell/app-sidebar.tsx:70-79`,
`src/components/app-shell/profile-nav.tsx:98-110`). Yellow and green have no marker.

## Initial Framing (preserved)

- **User's stated cause or approach**: (from the roadmap, S-09 Risk) S-09 is partly delivered by the
  red dot added in S-11; a yellow dot was tried and removed at the user's request. Open: whether S-09
  needs more than the red dot, and the dot lagging past midnight in a long-open tab.
- **User's proposed direction**: start S-09; scope undecided.
- **Pre-dispatch narrowing**: the yellow dot was removed because it was **too noisy**. Of the possible
  concerns, the user picked "can't tell yellow" and "nothing noticed"; the midnight lag was not picked.

## Dimension Map

1. **Spec vs. product decision** — FR-019 asks for a colour per profile; the red-only dot was a
   deliberate choice (yellow = noise). The gap may be in the PRD wording, not the app.
2. **Missing yellow signal** — caregivers can't see which other profiles run out within 30 days.
3. **Freshness** — the dot is computed in the preserved layout and can miss a profile that turns red
   after Warsaw midnight until reload or a medication change.
4. **Correctness of the red dot** — it could disagree with the main page (ran-out, paused).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Spec wording lags a deliberate decision | Yellow dot tried and removed (`context/archive/2026-11-18-profile-avatars/change.md:21`); user: "too noisy" and "red is enough" | STRONG |
| 2. Yellow across profiles is a real need | Sidebar is the only cross-profile signal (`app-sidebar.tsx:61-78`; page tiles and illustration are per profile, `src/app/(app)/page.tsx:80`), but the user answered "Red is enough" | WEAK |
| 3. Midnight lag matters | Accepted in the S-11 review as F3 (`context/archive/2026-11-18-profile-avatars/reviews/impl-review.md:50-60`); user has not noticed it; self-corrects on reload or any medication change | WEAK |
| 4. Red dot disagrees with the main page | Dot uses `computeStock` + `overallUrgency` (`stock.ts:312-316`): ran-out counts as red, paused ignored, same as the page | NONE |

## Narrowing Signals

- "When does the yellow question come up?" → **Red is enough**; FR-019 can be reworded to red only.
  This rules out dimension 2 for v1.
- Midnight lag not picked as a concern → dimension 3 stays a known, accepted limitation.

## Cross-System Convention

Attention badges on lists (unread counts, alert dots) are normally shown only for the state that needs
action now; showing a colour on every item turns the marker into decoration. The red-only dot follows
that convention, and matches the PRD's own red threshold (≤ 14 days).

## Reframed Problem Statement

> **The actual problem to plan around is**: FR-019's wording ("colour of its most urgent medication")
> no longer matches the accepted product decision — a red-only marker for profiles with a red or
> ran-out medication, which S-11 already shipped.

No app feature is missing. S-09 closes by aligning the docs (PRD FR-019, roadmap S-09) with what was
built, and by recording the midnight lag as a known limitation (or fixing it, if cheap) so it stops
being an open item.

## Confidence

**HIGH** — the code confirms the dot matches the main page's red logic, the decision to drop yellow is
recorded, and the user's narrowing answer ("Red is enough") was decisive.

## What Changes for /10x-plan

The plan is a docs-only close-out, not a feature: amend FR-019 to the red-only marker, mark S-09 done
with a note pointing to S-11 (PR #23), and decide the midnight lag explicitly (accept and document, or
a small refresh). It may be small enough to skip /10x-plan and do directly.

## References

- Source files: `src/components/app-shell/app-sidebar.tsx:56-99`, `src/components/app-shell/profile-nav.tsx:98-110`, `src/lib/medications/stock.ts:308-316`, `src/app/(app)/page.tsx:80`
- PRD: `context/foundation/prd.md:87-89`; roadmap S-09
- Prior decisions: `context/archive/2026-11-18-profile-avatars/change.md:21-23`, `.../reviews/impl-review.md:50-60`
