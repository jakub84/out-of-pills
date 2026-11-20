---
date: 2026-11-20T11:40:00+01:00
researcher: Claude
git_commit: 4bc2d55
branch: medications/edit-and-pause-medication
repository: out-of-pills
topic: "S-07 edit-and-pause-medication: how to edit a medication (incl. dosage) and pause/resume it without retroactively changing consumed pills"
tags: [research, medications, stock, supabase, rls, s-07]
status: complete
last_updated: 2026-11-20
last_updated_by: Claude
---

# Research: Edit dosage and pause / resume a medication (S-07)

**Date**: 2026-11-20T11:40:00+01:00
**Researcher**: Claude
**Git Commit**: 4bc2d55
**Branch**: medications/edit-and-pause-medication
**Repository**: out-of-pills

## Research Question

Roadmap S-07 (FR-010, FR-012): what does the current code need so a caregiver can edit a medication (including its daily dose) and pause / resume it, with the calculation following the new values from that moment, a paused medication not decreasing, and no retroactive change to pills already consumed? Which contracts (schema, RLS, grants, triggers, `stock.ts`, UI, tests) are affected, and what product choices remain?

## Summary

- **No time-segment history is needed.** A medication stores a stock *baseline*, not a ledger: `pills_counted` + `counted_on` + `daily_dose` (`supabase/migrations/20261116185940_medications.sql:9-28`), and `computeStock()` derives today's figures as `max(0, counted − dose × elapsed days)` (`src/lib/medications/stock.ts:103-104`). S-06 already rebases this baseline to "pills left today, counted today" for restock and correction (`stock.ts:141-158`, `actions.ts:97-183`). Doing the same rebase *before* changing the dose or the pause state collapses the past into the new count, so the past segment can never be recalculated with new values. This answers the roadmap risk ("calculation over time segments", `context/foundation/roadmap.md` S-07) with the existing pattern.
- **A dose change needs a conservative rebase, not the plain S-06 one.** Today counts as day 1 (`stock.ts:105-106`), so today's dose is still inside the "pills left today" number. If today's dose was already taken at the *old* dose and the new dose is *lower*, a plain rebase at the new dose shows a run-out date one day later than reality, breaking the guardrail (worked example below). Rebasing to `pillsLeftToday − max(0, oldDose − newDose)` keeps the date never later in both "taken / not yet taken" cases; for `newDose ≥ oldDose` it equals the plain rebase.
- **Pause needs a new column and a change in `computeStock`.** Nothing in the schema represents a paused state today (`20261116185940_medications.sql:9-28`; no later migration adds one). Proposed: nullable `paused_on date`; pausing rebases (conservatively, today's dose assumed taken) and sets `paused_on`; while paused `computeStock` returns the frozen count with no run-out date; resuming rebases to (frozen count, today) and clears `paused_on`, so paused days never decrease the stock.
- **Database contracts block edits today.** `authenticated` may update only `pills_counted`, `counted_on` (`20261117120803_medications_stock_updates.sql:30`) and `package_size` (`20261117131550_medications_package_size_update.sql:7`); `name` and `daily_dose` updates are rejected and pgTAP asserts that (`supabase/tests/database/medications_update.test.sql:62-68`). The `counted_on`-must-be-today trigger fires only when `pills_counted` or `counted_on` change (`20261117120803_…:43-45`), so it would *not* stop a write that changes `daily_dose` alone — which is exactly the retroactive change S-07 must prevent.
- **UI entry point exists.** The card's "⋯" menu already has a disabled "Edit" item marked for S-07 (`src/components/medications/medication-options-menu.tsx:17-18,36-39`); there is no pause item yet.

## Detailed Findings

### Stock model and calculation (`src/lib/medications/stock.ts`)

- `StockInput` = `{ pillsCounted, countedOn, dailyDose }` (`stock.ts:15-22`); no pause field.
- `computeStock` (`stock.ts:94-127`): `elapsed = max(0, days(countedOn → today))`; `leftHalves = max(0, counted − dose × elapsed)`; `daysLeft = floor(left / dose)` with today as day 1; `runOutDate = today + daysLeft − 1`; ran-out branch returns `lastCoveredDay`. Counts are half-tablet integers (`stock.ts:79-85`).
- Rebase helpers keep `dailyDose` unchanged and date the new count today: `addPackage` (`stock.ts:141-149`), `correctCount` (`stock.ts:152-158`). Neither takes a new dose or pause state.
- Ordering/aggregation: `compareByRunOut` (`stock.ts:169-183`), `groupByUrgency` (`stock.ts:186-199`), `overallUrgency` (`stock.ts:202-206`) all assume every item has a numeric `daysLeft` and one of four urgencies; a paused item has no defined place in them yet.
- AGENTS.md hard rule: run-out maths lives only in `stock.ts` and changes test-first; tests are in `src/lib/medications/stock.test.ts` (300 lines).

### Worked example — why a dose decrease needs the conservative rebase

Inputs: pills left today `L = 10` (today's dose not yet subtracted, per `stock.ts:105`), old dose 2/day, new dose 1/day, edit made today.

- Real case A — today's 2 tablets already taken before the edit: 8 left tomorrow at 1/day → last covered day = today + 8.
- Plain rebase (10 counted today at 1/day, today = day 1) → `runOutDate` = today + 9. **One day later than real → violates the guardrail.**
- Conservative rebase `10 − max(0, 2 − 1) = 9` counted today at 1/day → today + 8 (case A exact); real case B (today's dose not yet taken, 1 tablet taken today) → today + 9, app shows today + 8 → earlier, allowed.

For an increase (old 1, new 2, L = 10) the plain rebase gives today + 4 in both cases A and B, so `max(0, old − new) = 0` and the formulas coincide. This is an inference from `computeStock` arithmetic, not existing code; it should become the first unit tests of the plan.

### Pause / resume semantics (inference, to be fixed in the plan)

- Pause on day X: frozen count `P = max(0, L − dose)` (today's dose assumed taken — the conservative choice; assuming "not taken" would show one dose too many if it was). Store `pills_counted = P`, `counted_on = X`, `paused_on = X`.
- While paused: `pillsLeft = P` for any later day; no `runOutDate`, no `daysLeft` countdown.
- Resume on day Y: `pills_counted = P`, `counted_on = Y`, `paused_on = null`; day Y counts as day 1 again.
- Pause and resume on the same day loses one dose (`L − dose`); the date only moves earlier, so the guardrail holds; the user can fix it with "Correct count".
- Restock / correction while paused: `updateStock` reads the row and calls `rebase` (`actions.ts:121-147`); the rebase helpers must carry the pause state through and `computeStock` must not decrease a paused count, otherwise a restock during a pause would apply elapsed days.

### Database: schema, RLS, grants, trigger

- Table columns: `id, profile_id, name (1–80), package_size (1–1000), pills_counted numeric(6,1) half-steps 0–9999, daily_dose numeric(4,1) half-steps >0 ≤50, counted_on date default Warsaw today, created_at` (`20261116185940_medications.sql:9-28`).
- RLS: select and insert by profile membership (`…medications.sql:35-57`); update policy with the same membership in `using` and `with check` (`20261117120803_…:8-26`). No delete policy (S-08).
- Column grants for `update`: `pills_counted, counted_on` (`20261117120803_…:30`), `package_size` (`20261117131550_…:7`). S-07 needs additional grants for at least `name`, `daily_dose` and the new pause column, in a **new** migration (AGENTS.md: never edit a pushed migration).
- Trigger `medications_stock_counted_today` (`20261117120803_…:37-57`) raises `OP001` when `pills_counted`/`counted_on` change and `counted_on` ≠ Warsaw today. To make "dose or pause change without a same-day rebase" impossible at the database level, the condition needs to include `daily_dose` and the pause column; a new migration can `create or replace` the function (the trigger binding stays).
- pgTAP: `medications_update.test.sql` asserts `name` and `daily_dose` updates fail with `42501` (lines 62-68). Those assertions will flip in S-07; the test file (not a migration) can change.

### Server actions (`src/lib/medications/actions.ts`)

- `updateStock` (`actions.ts:97-183`) is the reusable guarded write: validates input, re-reads the row, compares it with the baseline the user saw (`expectedPillsCounted`, `expectedCountedOn`; `actions.ts:134-137`), rebases with `todayInWarsaw()`, then updates with the same baseline in `.eq` filters (`actions.ts:153-163`) and maps `OP001` to "The day just changed" (`actions.ts:166-169`). It writes only `pills_counted`, `counted_on`, optional `package_size` (`actions.ts:155-159`).
- Edit and pause/resume fit this optimistic-concurrency shape; the guard should also cover `daily_dose` and the pause state, so an edit based on a stale dose or a double pause/resume is rejected as stale.
- AGENTS.md: successful saves show a toast from `src/lib/feedback/messages.ts` (currently `medicationAddedMessage`, package-added message at lines 5-12) and run through `runSaveAction`.

### Read path and consumers of `computeStock`

- DAL selects `id, name, package_size, pills_counted, daily_dose, counted_on` (`src/lib/medications/dal.ts:54,73`) and maps them in `toMedication` (`dal.ts:32-41`); the pause column must be added to both selects, the `Medication` type and `database.types.ts` (via `npm run db:types`).
- Consumers found by `grep computeStock|overallUrgency|groupByUrgency` over `src/` (non-test): main page builds `OverviewItem`s and groups them (`src/app/(app)/page.tsx:60-79`); sidebar red dot per profile (`src/components/app-shell/app-sidebar.tsx:73-74`); add-package preview (`add-package-dialog.tsx:95,118`); correct-count preview (`correct-count-dialog.tsx:69,83`); add-medication draft preview (`medication-draft.ts:71`); header illustration via `overallUrgency` (`page.tsx:79`, `stock-illustration.tsx`). Each must decide what a paused item shows / counts as.
- Card renders "<dose> tabl. daily · <left> tabl. left", days left or "Ran out", a bar, "+ Add package" and the "⋯" menu (`src/components/medications/medication-card.tsx:29-93`); `OverviewItem` carries the baseline fields the dialogs send back as the expected baseline (`medication-card.tsx:9-14`).

### UI building blocks for the edit dialog

- Add flow is a two-step wizard (`add-medication-dialog.tsx:58,97,230-248`) with a draft model and chips for package size and dose (`medication-draft.ts:10-40`) and validation helpers `validateDailyDose`, `validatePackageSize`, `validatePillsLeft` (`src/lib/medications/validation.ts`). The details step and dose chips are candidates for reuse in an edit dialog; pills left stays with "Correct count" unless the plan decides otherwise.
- Options menu (`medication-options-menu.tsx:20-54`) holds dialog open state locally and renders `CorrectCountDialog`; an edit dialog and a pause/resume item would follow the same pattern.

## Code References

- `src/lib/medications/stock.ts:15-22` — `StockInput` (no pause field)
- `src/lib/medications/stock.ts:94-127` — `computeStock`, today = day 1
- `src/lib/medications/stock.ts:141-158` — S-06 rebase helpers (`addPackage`, `correctCount`)
- `src/lib/medications/stock.ts:169-206` — sort, grouping, overall urgency
- `src/lib/medications/actions.ts:97-183` — guarded `updateStock`
- `src/lib/medications/dal.ts:8-41,54,73` — `Medication` type, mapping, selects
- `supabase/migrations/20261116185940_medications.sql:9-57` — table, select/insert RLS
- `supabase/migrations/20261117120803_medications_stock_updates.sql:8-57` — update RLS, column grant, `OP001` trigger
- `supabase/migrations/20261117131550_medications_package_size_update.sql:7` — `package_size` grant
- `supabase/tests/database/medications_update.test.sql:62-68` — asserts name/dose not updatable
- `src/components/medications/medication-options-menu.tsx:36-39` — disabled "Edit" placeholder
- `src/components/medications/medication-card.tsx:29-93` — card layout
- `src/app/(app)/page.tsx:60-79`, `src/components/app-shell/app-sidebar.tsx:73-74` — urgency consumers

## Architecture Insights

- Baseline-not-ledger is the core design: every mutation so far is "compute today's pills, store them as a new count dated today". S-07 should extend it rather than introduce dose/pause history tables. FR-018 (history, nice-to-have) would need a separate append-only log later; the baseline model does not preclude it.
- Concurrency is optimistic per row (expected baseline in the update filter) plus a database-dated `counted_on`; keep both for edit and pause.
- Pure `stock.ts` functions are also what demo mode (S-10, FR-020, no Supabase writes) will reuse, so pause/edit rebasing belongs there, not in the action.
- S-05 (irregular schedules, FR-008) will later change what "dose" means; keeping the dose input as a reusable piece of the edit dialog and the rebase as a `stock.ts` function lets S-05 extend both.

## Historical Context (from prior changes)

- `context/archive/2026-11-16-first-medication-run-out/plan.md:56` — "today's dose is assumed to come out of the stock, so today counts as day 1". Supported by current code (`stock.ts:105-106`).
- `context/archive/2026-11-17-restock-and-correct/plan.md:9` — describes the baseline model and `computeStock` formula. Supported (`stock.ts:94-127`, line numbers still match).
- `context/archive/2026-11-17-restock-and-correct/plan.md:49` — "Never subtract or skip today's dose when rebasing; any other order moves the date later." Supported for rebases that keep the dose (restock, correction). Partial for S-07: with a dose *decrease*, subtracting `oldDose − newDose` is needed to keep the date from moving later (worked example above); for pause, subtracting today's dose moves the date earlier, which the guardrail allows.
- `context/foundation/prd.md:103-104` — FR-010 and its Socrates note: temporary dosages (e.g. double for 5 days) are handled by editing the medication, not by a separate feature.
- `context/foundation/prd.md:107-110,139` — FR-012; "A paused medication does not decrease"; pausing stays separate from deletion.

## Related Research

Not applicable — no earlier `research.md` exists under `context/changes/` or `context/archive/` for edit or pause.

## Open Questions

Product choices for `/10x-plan` (code does not decide them):

1. **What does the edit dialog change?** Name, package size and daily dose are the obvious fields; is pills left also editable there, or stays in "Correct count"?
2. **Dose decrease conservatism** — accept `L − (oldDose − newDose)` (may under-count by a few tablets when today's dose was not yet taken; fixable via "Correct count"), or ask the user "Has today's dose already been taken?" in the dialog?
3. **Pause conservatism** — assume today's dose taken at pause (recommended, guardrail-safe) vs. asking.
4. **How a paused medication is shown** — label "Paused" with frozen pill count and no date; does it sit in its own group / at the end, and is it excluded from the red/yellow/green counts, the sidebar red dot and the header illustration?
5. **Can a paused medication be edited or restocked?** Technically yes once rebases carry the pause state; UX may hide "Add package" while paused.
6. **"Discontinue" vs pause** — FR-012 says "pause / discontinue"; is pause-indefinitely enough until S-08 adds deletion?
