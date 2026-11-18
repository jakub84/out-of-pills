# Restock and Correct — Plan Brief

> Full plan: `context/changes/restock-and-correct/plan.md`

## What & Why

Roadmap S-06 (FR-009, FR-011, issue #14). Caregivers need to keep the stock accurate without retyping a medication: add a new package in one action ("+ package", count pre-filled and editable) and correct the tablets left after a recount or a lost pill. The PRD names fast re-adding of a package as the main UX guardrail for repeat use.

## Starting Point

S-03 stores each medication as "N tablets counted on day D" plus a daily dose and computes today's figures on read (`src/lib/medications/stock.ts`). The table has select and insert policies only; `counted_on` is stamped by the database and the client can't write it. Cards have no actions yet. Figma `182:304` shows the add-package dialog; there is no mock for the correction.

## Desired End State

Every card has "+ Add package" and "Correct count". Adding a package turns "18 tabl. · 9 days" into "48 tabl. · 24 days" (at 2/day) and moves the card to its new urgency group at once; correcting sets the count as of today. Double clicks, stale tabs and midnight never double-add or date the stock wrongly — the user gets "check the numbers and try again" with fresh figures.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where the correction lives | Two card buttons: "+ Add package" (primary) and "Correct count" | Both actions one tap away, each dialog focused; matches the mock for the package. |
| Edited package amount | Applies to this package only; remembered size stays | A one-off 28-tablet box shouldn't change the default; size editing comes with S-07. |
| History | Overwrite the baseline, no events table | FR-018 (history) is parked; keeps the slice small before 2026-11-27. |
| Double / stale submit | Conditional update on the shown baseline; mismatch → error with fresh numbers | A repeat can never add a package twice — overstated stock is a late-side error. |
| Data model | Both actions write `pills_counted` + `counted_on = today` | One update path, no change to the run-out maths; S-07 can reuse it. |
| Date ownership | Column grant on `counted_on` + trigger requiring Warsaw today (SQLSTATE `OP001`) | Closes the midnight race that would skip a day's dose. |
| Today's dose | Still taken from the new count (today = day 1) | Same rule as adding a medication; keeps the date on the early side. |

## Scope

**In scope:** `addPackage` / `correctCount` helpers in `stock.ts` (test-first); migration with update policy, two-column grant and date trigger; pgTAP; two server actions with validation and stale/day-changed errors; two dialogs on every card; "No tablets left" wording for a zero count; AGENTS.md; migration push and PR.

**Out of scope:** stock history (FR-018), changing the remembered package size, editing/pausing (S-07), deleting and "⋯" (S-08), sidebar urgency (S-09), demo mode (S-10), irregular schedules (S-05), undo, package-count chips, E2E tests.

## Architecture / Approach

Card (Server Component) → client dialog with previews from `computeStock` + the new helpers using the server's `today` → server action: validate → read the row (RLS) → compare with the shown baseline → compute the new baseline → conditional `update … where id, pills_counted, counted_on match` → the trigger checks `counted_on` is Warsaw today → `revalidatePath`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Stock rebasing and database | Tested helpers, update policy/grant/trigger, pgTAP, types | RLS or the column grant letting more than the stock change |
| 2. Server actions | `addPackage`, `correctPillCount` with stale and midnight handling | A repeated submit applying twice |
| 3. Card dialogs and release | Mock `182:304` dialog, correction dialog, docs, migration push, PR | Card crowding at 375 px |

**Prerequisites:** S-03 merged (done); local Supabase stack with Docker; Supabase CLI linked to the cloud project for the push.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- A recount done in the evening after today's dose will show the date one day early — accepted, it errs on the safe side.
- A pharmacy that permanently switches box size needs the amount edited on each restock until S-07 adds editing.

## Success Criteria (Summary)

- From any card, adding a package or correcting the count takes one dialog and the overview updates immediately with the right group and date.
- The run-out date is never later than real, including after double submits and around midnight.
- Another user can't change your medications (pgTAP green).
