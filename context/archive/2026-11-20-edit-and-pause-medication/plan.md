# Edit and Pause a Medication Implementation Plan

## Overview

Roadmap S-07 (`edit-and-pause-medication`; FR-010, FR-012): a caregiver can edit a medication (name + strength, pills per package, daily dose, pills left) and pause / resume it. From the moment of the change the calculation follows the new values; a paused medication does not decrease. Pills already consumed are never recalculated, and the shown run-out date is never later than the real one (PRD, Business Logic).

## Current State Analysis

- A medication stores a stock **baseline**, not a ledger: `pills_counted`, `counted_on` (Warsaw date stamped by the database), `daily_dose`, `package_size` (`supabase/migrations/20261116185940_medications.sql:9-28`). `computeStock()` derives today's figures; today counts as day 1 (`src/lib/medications/stock.ts:94-127`).
- S-06 rebases that baseline to "pills left today, counted today" for restock and correction (`stock.ts:141-158`) through one guarded server write, `updateStock` (`src/lib/medications/actions.ts:97-183`), which compares the row with the baseline the user was shown and repeats that comparison in the `update … where` filter.
- There is no paused state anywhere (schema, `StockInput`, UI).
- `authenticated` may update only `pills_counted`, `counted_on`, `package_size` (`20261117120803_medications_stock_updates.sql:30`, `20261117131550_medications_package_size_update.sql:7`); pgTAP asserts `name` / `daily_dose` updates fail (`supabase/tests/database/medications_update.test.sql:62-68`).
- Trigger `medications_stock_counted_today` (`20261117120803_…:37-57`) forces `counted_on` = Warsaw today only when `pills_counted` / `counted_on` change, so a dose-only write would slip through and retroactively change consumption.
- The card's "⋯" menu already has a disabled "Edit" item for S-07 (`src/components/medications/medication-options-menu.tsx:36-39`).

Full evidence: `context/changes/edit-and-pause-medication/research.md`.

## Desired End State

- "⋯ → Edit" opens a dialog with name, package size, daily dose and pills left. Lowering the dose lowers the pre-filled pills left by `old − new` (today's old dose assumed taken) until the user types a number; a preview shows the resulting days and date. Saving shows "<name> updated".
- "⋯ → Pause" confirms and freezes the stock at `pills left today − today's dose`; the card moves to a muted "Paused" group after green, shows the frozen count and "Paused since <date>", no date tile, no bar, no "+ Add package", and no longer counts towards the red/yellow/green tiles, the "running out" line, the sidebar red dot or the header illustration.
- "⋯ → Resume" confirms and restarts consumption from that day (day 1) with the frozen count.
- While paused, Edit and Correct count still work and keep the medication paused.
- The database rejects any change of dose or pause state that is not a same-day rebase.

Verify: unit tests in `stock.test.ts`, pgTAP in `medications_update.test.sql`, and the manual steps below.

### Key Discoveries:

- Rebasing to "today" before changing values is what prevents retroactive recalculation; no time-segment history is needed (`research.md`, Summary).
- Plain rebase at a lower dose shows a date one day too late when today's old dose was already taken (worked example in `research.md`); `L − max(0, old − new)` fixes it and equals the plain rebase for increases.
- `context/archive/2026-11-17-restock-and-correct/plan.md:49` ("never subtract or skip today's dose when rebasing") holds for dose-preserving rebases only; S-07 deliberately subtracts on dose decrease and on pause, which only moves dates earlier.
- `MedicationDraft.pillsMode` (`src/components/medications/medication-draft.ts:14-19`) is the existing "auto until the user types" pattern to mirror for the pills-left field.
- `urgency.ts` maps `Urgency` with `Record<Urgency, …>`, so adding a `paused` urgency makes the compiler list every place that must handle it.

## What We're NOT Doing

- No dose / pause history table and no stock-change history (FR-018, nice-to-have).
- No "Has today's dose been taken?" question — the conservative assumption is applied silently (user decision).
- No separate "discontinue" state: an indefinite pause covers it until S-08 adds removal.
- No restock of a paused medication: "+ Add package" is hidden while paused (Correct count stays available).
- No scheduled pause / resume dates, no future-dated dose changes.
- No irregular schedules (S-05) and no rename / delete of profiles or medication removal (S-08).
- No changes to the add-medication wizard beyond extracting shared pieces if the edit dialog reuses them.

## Implementation Approach

Every S-07 write is a rebase: compute today's figures from the stored row, apply the change, store the result as a new count dated today. The pure functions live in `stock.ts` (test-first, AGENTS.md rule), the database enforces "dose / pause changes only with a today-dated count", the server actions reuse the guarded-update shape of `updateStock`, and the UI adds one edit dialog, two small confirm dialogs and a paused card variant. Order: maths → database → actions → UI.

## Critical Implementation Details

- **Server recomputes auto values.** The edit form sends `pillsMode` (`auto` | `manual`). In `auto` the server recomputes pills left from the stored row and the server's `todayInWarsaw()`; the client's pre-filled number is never trusted, because a dialog opened before midnight would otherwise save yesterday's (higher) count as today's. In `manual` the typed number is saved as-is, like Correct count.
- **Paused rows and the baseline guard.** All guarded updates (existing restock / correction and the new actions) compare `pills_counted`, `counted_on`, `daily_dose` and `paused_on` with what the user was shown, so a double pause / resume or an edit based on a stale dose returns the existing stale-stock error instead of applying twice.

## Phase 1: Stock maths for edit, pause and resume

### Overview

Extend the pure calculation module, test-first, with the paused state and the three new rebases; keep restock and correction carrying the pause state.

### Changes Required:

#### 1. Stock input, output and calculation

**File**: `src/lib/medications/stock.ts`

**Intent**: Represent a paused medication and make `computeStock` freeze it; add `paused` to the urgency set so every consumer must decide how to show it.

**Contract**: `StockInput` gains `pausedOn: string | null` (`YYYY-MM-DD`, Warsaw). `Urgency` gains `"paused"`. When `pausedOn` is set, `computeStock` returns `pillsLeft = pillsCounted` regardless of elapsed days, `daysLeft = floor(pillsCounted / dailyDose)` (supply after resuming), `runOutDate = null`, `lastCoveredDay = null`, `urgency = "paused"`. Unpaused behaviour unchanged.

#### 2. New rebases

**File**: `src/lib/medications/stock.ts`

**Intent**: One function per S-07 write, each returning the new baseline dated `today`.

**Contract**:

```ts
// L = computeStock(input, today).pillsLeft (for a paused input: the frozen count)
editStock(input, today, { dailyDose, pillsLeft: number | null }): StockInput
//   pillsLeft !== null → pillsCounted = pillsLeft            (manual: user counted)
//   paused             → pillsCounted = L                    (nothing consumed while paused)
//   otherwise          → pillsCounted = max(0, L − max(0, input.dailyDose − dailyDose))
//   countedOn = today, dailyDose = new, pausedOn kept
pauseStock(input, today): StockInput    // unpaused only; pillsCounted = max(0, L − dailyDose), countedOn = today, pausedOn = today
resumeStock(input, today): StockInput   // paused only;   pillsCounted unchanged, countedOn = today, pausedOn = null
```

`pauseStock` on a paused input and `resumeStock` on an unpaused input throw a `RangeError`. All arithmetic stays in half-tablet integers.

#### 3. Existing rebases, ordering and aggregation

**File**: `src/lib/medications/stock.ts`

**Intent**: Keep the pause state through restock and correction, and keep paused items out of urgency signals.

**Contract**: `addPackage` and `correctCount` copy `pausedOn` from the input. `groupByUrgency` returns `{ red, yellow, green, paused }`; paused items are sorted by name, then id. `overallUrgency` ignores paused items (only paused → `"green"`). `compareByRunOut` is unchanged for non-paused items.

#### 4. Unit tests (written first)

**File**: `src/lib/medications/stock.test.ts`

**Intent**: Pin the guardrail cases before implementation.

**Contract**: covers at least — paused stock does not decrease over 10 days, has no date, `urgency` `paused`; dose decrease 2 → 1 with `L = 10` gives 9 counted today → run-out today + 8; dose increase 1 → 2 with `L = 10` gives 10 counted today → today + 4; manual pills left wins over the auto adjustment; dose edit while paused keeps the count and the pause; dose decrease larger than `L` clamps at 0; pause with `L = 10`, dose 2 → frozen 8; pause after running out → 0; pause then resume 5 days later → 8 counted on resume day, day 1 = resume day; same-day pause + resume loses exactly one dose; pause / resume on the wrong state throws; restock and correction keep `pausedOn`; `groupByUrgency` puts paused items in `paused` only; `overallUrgency` ignores a paused red-level item; halves (1.5/day) stay exact.

#### 5. Compile-level consumers

**Files**: `src/components/medications/urgency.ts`, `src/components/medications/medication-overview.tsx`, `src/app/(app)/page.tsx`, `src/components/app-shell/app-sidebar.tsx`, `src/components/medications/medication-draft.ts`, dialogs passing `StockInput`

**Intent**: Keep the build green after the type changes; visible paused UI arrives in Phase 4.

**Contract**: `Record<Urgency, …>` maps gain a `paused` entry using existing muted tokens (no hex, no `zinc-*`); places building a `StockInput` pass `pausedOn: null` until Phase 2 reads the column; `UrgencyGroup` / `URGENCY_GROUPS` stay red / yellow / green for now.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new paused / edit / resume cases: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- The worked examples in the test names read correctly to the user (dose decrease, pause, same-day pause + resume)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Database — pause column, edit grants, same-day guard

### Overview

One additive migration that lets caregivers edit and pause their medications while making a non-rebased dose or pause change impossible; pgTAP proves it; the DAL reads the new column.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_medications_edit_and_pause.sql` (via `npx supabase migration new medications_edit_and_pause`)

**Intent**: Add the pause state and open exactly the columns S-07 edits; extend the "counted today" rule to dose and pause changes.

**Contract**:
- `alter table public.medications add column paused_on date` (nullable) with check `paused_on is null or paused_on <= counted_on`.
- `grant update (name, daily_dose, paused_on) on public.medications to authenticated` — insert grant unchanged, so new medications start unpaused.
- `create or replace function public.medications_stock_counted_today()`: raise `OP001` when any of `pills_counted`, `counted_on`, `daily_dose`, `paused_on` changes and `new.counted_on` ≠ Warsaw today; also raise `OP001` when `paused_on` changes to a non-null value other than Warsaw today. The existing trigger binding and `revoke execute` stay valid.
- Header comment states that S-07 opens these columns and why the trigger now covers dose and pause.

#### 2. pgTAP

**File**: `supabase/tests/database/medications_update.test.sql`

**Intent**: Replace the "cannot update name / daily_dose" assertions with the S-07 rules.

**Contract**: caregiver can rename and change the dose together with a today-dated count; a dose-only change on a row counted on an earlier day raises `OP001`; setting `paused_on` to today together with a today count succeeds, to yesterday raises; `paused_on` later than `counted_on` violates the check; another caregiver's row is still not updatable (0 rows); `paused_on` cannot be set on insert; name / dose constraints (length, half steps, range) still apply.

#### 3. Types and data access

**Files**: `src/lib/supabase/database.types.ts` (generated), `src/lib/medications/dal.ts`

**Intent**: Read the pause state wherever medications are listed.

**Contract**: `npm run db:types` regenerates types; both selects add `paused_on`; `Medication` gains `pausedOn: string | null`; Phase 1's temporary `pausedOn: null` call sites switch to the real value.

### Success Criteria:

#### Automated Verification:

- Local database rebuilds from all migrations: `npx supabase db reset`
- pgTAP tests pass: `npx supabase test db`
- Generated types start with `export type` and include `paused_on`: `npm run db:types`
- Lint, unit tests and build pass: `npm run lint`, `npm test`, `npm run build`

#### Manual Verification:

- Existing medications still show the same figures as before the migration

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Push the migration to the cloud project (`npx supabase db push --remote`, `--dry-run` first) before merging the PR.

---

## Phase 3: Server actions for edit, pause and resume

### Overview

Generalise the guarded update and add the three actions, with validation and toast wording.

### Changes Required:

#### 1. Guarded update

**File**: `src/lib/medications/actions.ts`

**Intent**: Make the S-06 guard cover dose and pause state, and let several actions share it.

**Contract**: the expected baseline read from the form adds `expectedDailyDose` and `expectedPausedOn` (empty = not paused); the select, the stale comparison and the `update … where` filters include `daily_dose` and `paused_on` (`is null` when not paused). The update writes the rebase result's `pills_counted`, `counted_on`, plus `daily_dose`, `paused_on`, `name`, `package_size` when the action provides them. `OP001` keeps mapping to the day-changed error. `addPackage` and `correctPillCount` behave as before and additionally reject a stale dose / pause state; `addPackage` on a paused medication returns the generic error.

#### 2. New actions

**File**: `src/lib/medications/actions.ts`

**Intent**: One server action per user action, each through the guarded update.

**Contract**:
- `editMedication(prev, formData): Promise<MedicationFormState>` — fields `name`, `packageSize`, `dailyDose`, `pillsMode` (`auto` | `manual`), `pillsLeft` (required for `manual`), plus the baseline fields; rebase with `editStock` (`pillsLeft: null` for `auto`); field errors as in add-medication.
- `pauseMedication(prev, formData): Promise<StockFormState>` — baseline fields only; rebase with `pauseStock`; already paused → stale error.
- `resumeMedication(prev, formData): Promise<StockFormState>` — baseline fields only; rebase with `resumeStock`; not paused → stale error.
- All revalidate `/` (layout) on success, as today.

#### 3. Validation

**File**: `src/lib/medications/validation.ts` (+ `validation.test.ts`)

**Intent**: Reuse the add-medication field validators for the edit form.

**Contract**: a `validateMedicationEdit` (or equivalent) built from `validateMedicationName`, `validatePackageSize`, `validateDailyDose` and `validatePillsLeft` (the last only in `manual` mode); unit-tested like `validateMedication`.

#### 4. Toast wording

**File**: `src/lib/feedback/messages.ts`

**Intent**: Central wording for the new successes (AGENTS.md rule).

**Contract**: `medicationUpdatedMessage(name)` → "Aspirin updated"; `medicationPausedMessage(name)` → "Aspirin paused"; `medicationResumedMessage(name)` → "Aspirin resumed".

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the edit validation: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Restock and correction still save and show their toasts exactly as before

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: UI — edit dialog, pause / resume, paused card and group

### Overview

Wire the actions into the card menu, add the paused presentation, and keep every save on `runSaveAction` + toast.

### Changes Required:

#### 1. Edit dialog

**File**: `src/components/medications/edit-medication-dialog.tsx` (new; shared pieces extracted from `medication-details-step.tsx` / `medication-draft.ts` if needed)

**Intent**: Single-step dialog to change name, package size, daily dose and pills left, with a live preview.

**Contract**: controlled like `CorrectCountDialog`; pre-fills from the medication; same chips and validation as add-medication; pills-left field starts at today's pills left and, while untouched (`pillsMode = auto`), follows `editStock(..., pillsLeft: null)` as the dose changes; typing or stepping switches to `manual`. Hint under the field: lowering the dose assumes today's dose at the old amount was already taken. Preview line via `StockLine` from `computeStock(editStock(...), today)`. Sends the baseline fields (extended `BaselineFields`). Success: toast `medicationUpdatedMessage`, dialog closes. Validation, stale and day-changed errors inline.

#### 2. Pause and resume dialogs

**File**: `src/components/medications/pause-medication-dialog.tsx` (new; one component for both directions is fine)

**Intent**: Small confirm dialogs that show the consequence before saving.

**Contract**: Pause — "Pause <name>?", "Stock stops decreasing. Today's dose is counted as taken.", frozen count from `pauseStock`; buttons "Cancel" / "Pause". Resume — "Resume <name>?", preview of days left and run-out date from `resumeStock`; "Cancel" / "Resume". Each submits through `runSaveAction`, shows its toast and closes.

#### 3. Options menu

**File**: `src/components/medications/medication-options-menu.tsx`

**Intent**: Enable Edit and add Pause / Resume.

**Contract**: items in order: Correct count, Edit, Pause (or Resume when paused), Remove (still disabled for S-08). Each opens its dialog; menu state pattern as for Correct count.

#### 4. Paused card, group and summary

**Files**: `src/components/medications/medication-card.tsx`, `src/components/medications/medication-overview.tsx`, `src/components/medications/urgency.ts`, `src/app/(app)/page.tsx`

**Intent**: Show paused medications calmly and keep them out of urgency signals.

**Contract**: `OverviewItem` carries `pausedOn`. Paused card: muted styling with existing tokens, date tile shows "–", "<dose> tabl. daily · <frozen> tabl. left", a "Paused since <en-GB date>" label instead of days left and bar, no "+ Add package". `MedicationGroups` renders a "Paused" group after green when non-empty; `RunOutTiles` stay red / yellow / green; "Total medications" counts all items, "running out" counts red only; header illustration uses `overallUrgency` (already ignores paused). Sidebar dot unchanged in code — it uses `overallUrgency`.

#### 5. Correct count while paused

**File**: `src/components/medications/correct-count-dialog.tsx`

**Intent**: The hint "Today's dose is taken from this number" is wrong for a paused medication.

**Contract**: when paused, the hint reads that the medication is paused and the count stays until it is resumed; the preview shows the frozen count without a date.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Production build passes: `npm run build`

#### Manual Verification:

- Edit: renaming, changing package size and raising the dose save with the toast "<name> updated" and the card shows the new values and date
- Edit: lowering the dose 2 → 1 lowers the pre-filled pills left by 1 and the preview matches the saved card; typing a number first keeps the typed number
- Edit: invalid values show inline errors with the dialog open; offline save shows the connection toast
- Pause: confirm dialog shows the frozen count; after saving, the card moves to "Paused" with "Paused since <today>", no date, no bar, no "+ Add package"
- Paused medication no longer affects the red / yellow / green tiles, "running out" line, sidebar red dot or header illustration
- Next day (or with the date changed locally) the paused count is unchanged
- Resume: preview shows days left from today; after saving the card returns to its urgency group with day 1 = today
- Edit and Correct count on a paused medication keep it paused
- Double-submitting pause (two tabs) shows the stale-stock error in the second tab
- Layout works at phone width and with keyboard only; toasts are announced

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `stock.test.ts`: all Phase 1 cases (guardrail examples, paused freezing, clamping, halves, state errors, grouping, overall urgency).
- `validation.test.ts`: edit validation in auto and manual pills mode.

### Integration Tests:

- pgTAP `medications_update.test.sql`: grants, same-day trigger for dose / pause, `paused_on` check, RLS isolation between caregivers.

### Manual Testing Steps:

1. Add "Test 2/day" with 10 tablets, edit dose to 1 → pills left pre-fills 9, card shows 9 days.
2. Pause it → frozen 8 (after the dose edit: 9 − 1), card in "Paused".
3. Change the machine date forward a few days (local stack) → still 8, no date.
4. Resume → run-out = today + 7.
5. Pause / resume in two tabs → second tab gets the stale error.

## Performance Considerations

None — one extra column in existing selects and the same single-row updates.

## Migration Notes

Additive migration; existing rows get `paused_on = null` (unpaused) and keep their figures. Release order per AGENTS.md: `db reset` → `test db` → `db:types` → `npx supabase db push --remote --dry-run` → push → check PR preview → merge.

## References

- Related research: `context/changes/edit-and-pause-medication/research.md`
- Guarded stock update to extend: `src/lib/medications/actions.ts:97-183`
- Rebase pattern: `src/lib/medications/stock.ts:141-158`
- Same-day trigger: `supabase/migrations/20261117120803_medications_stock_updates.sql:37-57`
- Dialog pattern: `src/components/medications/correct-count-dialog.tsx`
- Previous slice: `context/archive/2026-11-17-restock-and-correct/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stock maths for edit, pause and resume

#### Automated

- [x] 1.1 Unit tests pass, including the new paused / edit / resume cases: `npm test` — 7914634
- [x] 1.2 Lint passes: `npm run lint` — 7914634
- [x] 1.3 Production build passes: `npm run build` — 7914634

#### Manual

- [x] 1.4 The worked examples in the test names read correctly to the user (dose decrease, pause, same-day pause + resume) — 7914634

### Phase 2: Database — pause column, edit grants, same-day guard

#### Automated

- [x] 2.1 Local database rebuilds from all migrations: `npx supabase db reset` — 7945be4
- [x] 2.2 pgTAP tests pass: `npx supabase test db` — 7945be4
- [x] 2.3 Generated types start with `export type` and include `paused_on`: `npm run db:types` — 7945be4
- [x] 2.4 Lint, unit tests and build pass: `npm run lint`, `npm test`, `npm run build` — 7945be4

#### Manual

- [x] 2.5 Existing medications still show the same figures as before the migration — 7945be4

### Phase 3: Server actions for edit, pause and resume

#### Automated

- [x] 3.1 Unit tests pass, including the edit validation: `npm test` — 74947b9
- [x] 3.2 Lint passes: `npm run lint` — 74947b9
- [x] 3.3 Production build passes: `npm run build` — 74947b9

#### Manual

- [x] 3.4 Restock and correction still save and show their toasts exactly as before — 74947b9

### Phase 4: UI — edit dialog, pause / resume, paused card and group

#### Automated

- [x] 4.1 Lint passes: `npm run lint` — 2d705e2
- [x] 4.2 Unit tests pass: `npm test` — 2d705e2
- [x] 4.3 Production build passes: `npm run build` — 2d705e2

#### Manual

- [x] 4.4 Edit: renaming, changing package size and raising the dose save with the toast "<name> updated" and the card shows the new values and date — 2d705e2
- [x] 4.5 Edit: lowering the dose 2 → 1 lowers the pre-filled pills left by 1 and the preview matches the saved card; typing a number first keeps the typed number — 2d705e2
- [x] 4.6 Edit: invalid values show inline errors with the dialog open; offline save shows the connection toast — 2d705e2
- [x] 4.7 Pause: confirm dialog shows the frozen count; after saving, the card moves to "Paused" with "Paused since <today>", no date, no bar, no "+ Add package" — 2d705e2
- [x] 4.8 Paused medication no longer affects the red / yellow / green tiles, "running out" line, sidebar red dot or header illustration — 2d705e2
- [x] 4.9 Next day (or with the date changed locally) the paused count is unchanged — 2d705e2
- [x] 4.10 Resume: preview shows days left from today; after saving the card returns to its urgency group with day 1 = today — 2d705e2
- [x] 4.11 Edit and Correct count on a paused medication keep it paused — 2d705e2
- [x] 4.12 Double-submitting pause (two tabs) shows the stale-stock error in the second tab — 2d705e2
- [x] 4.13 Layout works at phone width and with keyboard only; toasts are announced — 2d705e2
