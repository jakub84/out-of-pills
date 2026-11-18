# Restock and Correct Implementation Plan

## Overview

Roadmap S-06 (`restock-and-correct`; FR-009, FR-011; GitHub issue #14): on every medication card the caregiver can add a new package in one action ("+ Add package", count pre-filled from the remembered package size and editable) and correct the number of tablets left after a recount. Both actions reset the medication's stock baseline to "N tablets, counted today", so the existing run-out calculation keeps working unchanged and the date still errs on the early side.

## Current State Analysis

- A medication stores its inputs, not a running total: `pills_counted`, `counted_on` (Warsaw date, stamped by the database), `daily_dose`, `package_size` (`supabase/migrations/20261116185940_medications.sql:9-28`). Today's figures come from `computeStock()` (`src/lib/medications/stock.ts:94-127`): `pillsLeft = max(0, counted − dose × elapsed days)`, today counts as day 1.
- RLS has select and insert policies only (`…_medications.sql:34-57`); the comment there says update and delete arrive with later slices. Grants: `select`, and `insert` limited to user-entered columns, so the client cannot write `counted_on` (`:64-68`). pgTAP: `supabase/tests/database/medications_rls.test.sql`.
- Server action pattern: `addMedication(prev, formData)` → `MedicationFormState`, starts with `getCurrentUser()`, validates with shared validators, logs failures, ends with `revalidatePath("/", "layout")` (`src/lib/medications/actions.ts:18-57`, `form-state.ts`). Validators and limits: `src/lib/medications/validation.ts` (`validatePillsLeft` 0–9999, half tablets; `parseAmount` accepts `,`).
- The overview computes `today = todayInWarsaw()` on the server and passes it into the client dialog as a prop (`src/app/(app)/page.tsx:66-77`) — the fix for review finding F1 (browser clock must not drive preview dates). The card (`src/components/medications/medication-card.tsx`) is a Server Component receiving `OverviewItem = StockItem & { dailyDose }`; it has no actions yet.
- UI kit: shadcn `dialog`, `button`, `input`, `label` exist in `src/components/ui/`; `chip-group.tsx` and the add-medication dialog show the stepper/input conventions; urgency classes in `src/components/medications/urgency.ts`; tablet/date formatting in `src/lib/medications/format.ts`.
- Figma `182:304` ("Dodaj opakowanie" — Add package): title, "<name> · 2 tabl. daily", "Remembered package: 30 tabl.", "Now: 18 tabl. · 9 days · until Sat 14 Nov", "After adding: 48 tabl. · 24 days · until Sun 29 Nov", amount stepper "+30 tabl." with "· stock extends by 15 days", "Cancel" / "Add 30 tabl.". No mock exists for the correction.

## Desired End State

- Each medication card (including ran-out ones) has "+ Add package" and "Correct count".
- "+ Add package" opens a dialog per mock `182:304`; confirming adds the amount to today's tablets left and the card moves to its new group immediately.
- "Correct count" opens a dialog that sets tablets left to the typed number as of today.
- A repeated or stale submit (double click, second tab, day change) never applies twice and never stamps a wrong date; the user sees a clear "check and try again" message with fresh numbers.
- Worked examples (Europe/Warsaw): a medication counted 18 tablets on 5 Nov at 2/day — on 8 Nov it shows 12 left; adding 30 → 42 tablets counted 8 Nov, 21 days, runs out Sat 28 Nov. Correcting it on 8 Nov to 7 → 7 tablets, 3 days, runs out Tue 10 Nov. A ran-out medication + 30 → 30 tablets, 15 days.
- No user can change another user's medications — proven by pgTAP.

Verify: walk the worked examples on the main screen, double-submit and two-tab tests, `npm test` and `npx supabase test db` green.

### Key Discoveries:

- Restock and correction are the same database write — new `pills_counted` with `counted_on = today` — so one update path serves both; S-07 (edit dose) can reuse it because changing the dose also needs a new baseline "from that moment" (FR-010).
- `counted_on` must stay database-controlled: the update grant covers `counted_on`, but a trigger rejects any value other than today's Warsaw date. This closes the midnight race (server computes tablets left for day D, the write lands on D+1) that a silent DB default would turn into a late-side error.
- The stale-submit guard is a conditional update: `where id = … and pills_counted = <shown> and counted_on = <shown>`; zero rows updated means the baseline moved.
- `computeStock` with `pillsCounted = 0` returns `lastCoveredDay = null`, so the card currently says "Not enough for a full day's dose" — wrong wording once "correct to 0" is possible.

## What We're NOT Doing

- Stock history / an events table (FR-018 is parked): each action overwrites the baseline.
- Changing the remembered package size from the add-package dialog — an edited amount applies to this package only (package size is edited with S-07).
- Editing name or dose, pausing (S-07); deleting and the "⋯" menu (S-08); sidebar urgency (S-09); demo mode (S-10); irregular schedules (S-05).
- Undo for a restock or correction (a correction fixes a mistake).
- Package-count chips ("2 packages") in the add-package dialog — the amount input covers it.
- Running migrations or pgTAP in CI; E2E tests.

## Implementation Approach

Data first, UI last, in the same order as S-03. Phase 1 adds the pure baseline helpers to `stock.ts` test-first and the database update path (policy, column grant, date trigger) with pgTAP proof. Phase 2 adds the two server actions with validation, the stale-submit guard and error mapping. Phase 3 adds the two dialogs to the card, updates docs, pushes the migration and opens the PR.

## Critical Implementation Details

**Order of today's dose.** The new baseline is dated today and today still counts as day 1, exactly like adding a medication: "Now: 18 tabl." + 30 = 48 counted today → 24 days. Never subtract or skip today's dose when rebasing; any other order moves the date later.

**Midnight and stale submits.** The action computes the new count with the server's `todayInWarsaw()` and writes `counted_on` = that date; the trigger raises a dedicated SQLSTATE (`OP001`) when it isn't the database's Warsaw today. The action maps `OP001` to "The day just changed — check the numbers and try again." and zero updated rows to "The stock just changed — check the numbers and try again."; both revalidate the page so the dialog reopens on fresh numbers.

## Phase 1: Stock rebasing and database

### Overview

Pure helpers that produce the new baseline, written test-first, and the RLS-guarded update path in the database.

### Changes Required:

#### 1. Baseline helpers

**File**: `src/lib/medications/stock.ts`, `src/lib/medications/stock.test.ts`

**Intent**: Keep all stock maths in the one tested module (Hard Rule): the new count after a package or a correction.

**Contract**:
- `addPackage(input: StockInput, today: string, tablets: number): StockInput` → `{ pillsCounted: computeStock(input, today).pillsLeft + tablets, countedOn: today, dailyDose: input.dailyDose }` (half-tablet integers internally, like `computeStock`).
- `correctCount(input: StockInput, today: string, tablets: number): StockInput` → `{ pillsCounted: tablets, countedOn: today, dailyDose: input.dailyDose }`.
- Both throw `RangeError` on a non-half-multiple or negative `tablets`.
- Tests first: the worked examples (12 left + 30 on 8 Nov → 42, 21 days, 28 Nov; correct to 7 → 3 days, 10 Nov); same-day restock (18 counted today + 30 → 48, 24 days); ran-out medication + 30 → 30 (deficit not carried over); halves (5.5 left + 0.5); correct to 0 → ran out with no last covered day; restock result never dated other than `today`.

#### 2. Migration

**File**: `supabase/migrations/<timestamp>_medications_stock_updates.sql`

**Intent**: Let a caregiver rewrite the stock baseline of their own profiles' medications, with the date still owned by the database.

**Contract**:
- Policy "Caregivers can update stock of their profiles' medications" `for update to authenticated`, `using` and `with check` = the same `profile_caregivers` membership `exists` as the select policy.
- `grant update (pills_counted, counted_on) on public.medications to authenticated` — name, dose, package size and profile stay read-only until their slices.
- `before update` trigger function (`set search_path = ''`): when `pills_counted` or `counted_on` changes, `new.counted_on` must equal `(now() at time zone 'Europe/Warsaw')::date`, otherwise `raise exception … using errcode = 'OP001'`.
- Replace nothing in the pushed `…_medications.sql` (frozen); this migration only adds.

#### 3. RLS tests

**File**: `supabase/tests/database/medications_rls.test.sql` (extend) or `medications_update.test.sql`

**Intent**: Repeatable proof that only the profile's caregiver can rewrite the stock, and only as of today.

**Contract**: a caregiver updates `pills_counted` + `counted_on` (today) on their own medication; user B's update of A's row affects 0 rows; anon cannot update; updating `name`, `daily_dose`, `package_size` or `profile_id` is denied (column privilege); `counted_on` yesterday or tomorrow raises `OP001`; changing `pills_counted` alone on a row counted yesterday raises `OP001`; the existing check constraints still reject 0.3 and 10000 tablets; a conditional update with a non-matching `pills_counted` affects 0 rows.

#### 4. Types

**File**: `src/lib/supabase/database.types.ts`

**Intent**: Keep generated types current.

**Contract**: `npm run db:types`; commit whatever it produces.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Migration applies on a clean database: `npx supabase db reset`
- RLS tests pass: `npx supabase test db`
- Generated types are current: `npm run db:types` leaves `git status` clean
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- The worked examples in `stock.test.ts` match the decided rule (12 + 30 on 8 Nov → 28 Nov; correct to 7 → 10 Nov; ran out + 30 → 30)
- In Studio (http://127.0.0.1:55323) `medications` shows select, insert and update policies

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server actions

### Overview

Two server actions in the existing form-state pattern, sharing one guarded update.

### Changes Required:

#### 1. Validation

**File**: `src/lib/medications/validation.ts`, `src/lib/medications/validation.test.ts`

**Intent**: Same limits on client and server, mirroring the migration checks.

**Contract**: `validatePackageAmount(value)` — 0.5–1000, half tablets ("Use a number from 0.5 to 1000" / "Use whole or half tablets, e.g. 30 or 30.5"); correction reuses `validatePillsLeft`; a resulting count above 9999 is a field error "That would be more than 9999 tablets". Unit tests for each boundary.

#### 2. Actions

**File**: `src/lib/medications/actions.ts`, `src/lib/medications/form-state.ts`

**Intent**: Apply a restock or correction only to the baseline the user was shown.

**Contract**:
- `addPackage(prev, formData)` and `correctPillCount(prev, formData)` → `StockFormState = { status: "idle" | "error" | "success"; message?: string; fieldErrors?: { tablets?: string } }`.
- Form fields: `medicationId`, `expectedPillsCounted`, `expectedCountedOn`, `tablets`.
- Flow: `getCurrentUser()`; validate `tablets`; select the row (`id, pills_counted, counted_on, daily_dose`; RLS-scoped) — missing → generic error; differs from the expected baseline → stale error; compute the new baseline with `addPackage` / `correctCount` and `todayInWarsaw()`; update `pills_counted`, `counted_on` with `.eq("id").eq("pills_counted", expected).eq("counted_on", expected).select("id")` — 0 rows → stale error; error code `OP001` → day-changed error; other errors → logged + generic "Something went wrong. Please try again."; success → `revalidatePath("/", "layout")`.
- Stale and day-changed errors also call `revalidatePath` so the page shows fresh figures.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- RLS tests still pass: `npx supabase test db`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Calling each action twice with the same expected baseline (e.g. a temporary form or two quick submits) changes the stock once and returns the stale error the second time

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Card dialogs and release

### Overview

"+ Add package" and "Correct count" on every card, then docs, migration push and PR.

### Changes Required:

#### 1. Card data and actions row

**File**: `src/app/(app)/page.tsx`, `src/components/medications/medication-card.tsx`

**Intent**: Give each card what the dialogs need, from the server.

**Contract**: `OverviewItem` gains `packageSize`, `pillsCounted`, `countedOn`; the page passes `today` down. The card gets an actions row: "+ Add package" (primary, small) and "Correct count" (outline/ghost, small), wrapping on narrow screens. `runOutLine`: ran out with `pillsLeft = 0` and no last covered day → "No tablets left"; with `pillsLeft > 0` → "Not enough for a full day's dose" (unchanged).

#### 2. Add package dialog

**File**: `src/components/medications/add-package-dialog.tsx`

**Intent**: Mock `182:304` in English: restock in one action with the effect visible before confirming.

**Contract**: `"use client"`; props `{ medication: { id, name, dailyDose, packageSize, pillsCounted, countedOn }, today }`. Content: title "Add package"; "<name> · <dose> tabl. daily"; "Remembered package: N tabl."; "Now: X tabl. · D days · until <date>" (or "Ran out"); amount input with −/+ (step 1, accepts .5), pre-filled with the package size; "· stock extends by K days"; "After adding: Y tabl. · D′ days · until <date>" with urgency dot; footer "Cancel" / "Add N tabl." (pending state; closes on success; shows field, stale and day-changed errors). Previews from `computeStock` + `addPackage` with the server `today`; dates `en-GB`, Warsaw.

#### 3. Correct count dialog

**File**: `src/components/medications/correct-count-dialog.tsx`

**Intent**: Fix the count after a recount or a lost pill (FR-011).

**Contract**: same props; title "Correct the count"; "<name> · <dose> tabl. daily"; "We expect now: X tabl."; label "How many tablets do you have now?" with −/+ input pre-filled with X; hint "Count every tablet you have, including open packages. Today's dose is taken from this number."; "After correcting: Y tabl. · D days · until <date>" (or "Ran out"); "Cancel" / "Save count". Same submit, error and close behaviour as the add-package dialog.

#### 4. Docs

**File**: `AGENTS.md`

**Intent**: Keep the agent guide accurate.

**Contract**: `src/lib/medications/` line mentions restock/correction actions; `src/components/medications/` mentions the add-package and correct-count dialogs.

#### 5. Migration push and PR

**File**: — (Supabase CLI, GitHub)

**Intent**: The PR preview reads the production database, so the schema must be there first.

**Contract**: after local gates: `npx supabase db push --remote --dry-run`, then (with user approval) `npx supabase db push --remote`; push the branch, open the PR against `master` referencing FR-009, FR-011 and "Closes #14". The migration is frozen from then on.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- RLS tests still pass: `npx supabase test db`
- On the PR, `Lint and build` and `preview` succeed: `gh pr checks`

#### Manual Verification:

- The add-package dialog matches mock `182:304` in English; for 18 tablets at 2/day counted today it shows "Now: 18 tabl. · 9 days", "+30", "extends by 15 days", "After adding: 48 tabl. · 24 days", and confirming moves the card to the right group
- Editing the amount to 28 adds 28 and the next "+ Add package" pre-fills 30 again
- "Correct count" to 7 on a 2/day medication shows 3 days; correcting to 0 shows "Ran out" and "No tablets left" at the top
- A ran-out medication + one package shows the package size as tablets left
- A double click adds the package once; submitting from a second, stale tab shows "The stock just changed…" and fresh numbers
- Invalid amounts (0, 0.3, 1001, a result above 9999) show field errors and nothing is saved
- Usable at 375 px and with keyboard only
- Before the PR opened, `npx supabase db push --remote` applied the migration (dashboard shows the update policy)
- On the PR preview, a real account can add a package and correct a count

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `stock.test.ts` — `addPackage` / `correctCount`: worked examples, same-day, ran-out, halves, zero, date always `today` (Phase 1).
- `validation.test.ts` — package amount and result-limit boundaries (Phase 2).

### Integration Tests:

- pgTAP — update isolation between users, anon denied, column grant, `OP001` date trigger, constraints, conditional update.
- The PR preview exercises the flow against the production database after the migration push.

### Manual Testing Steps:

1. Add "Metformax 500 mg", 30 per package, 18 left, 2/day → "+ Add package" shows 18 → 48, 9 → 24 days; confirm.
2. In Studio set its `counted_on` 3 days back and `pills_counted` 18 → card shows 12 left; add 30 → 42, 21 days.
3. "Correct count" to 7 → 3 days, red; to 0 → "Ran out", "No tablets left".
4. Open the same profile in two tabs, add a package in one, submit in the other → stale message, nothing doubled.
5. Edit the amount to 28 once; reopen → pre-filled 30.
6. Repeat 1 and 3 at 375 px and keyboard-only.

## Performance Considerations

- One extra select + one update per action on an indexed primary key; negligible.

## Migration Notes

- Third migration; additive (policy, grant, trigger). No data changes.
- Rollback: a follow-up migration dropping the trigger, policy and grant. Never edit the pushed migration.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-06), GitHub issue #14
- PRD: FR-009, FR-011, Business Logic, Guardrails (`context/foundation/prd.md`)
- Figma file `jThXxph37aBIqtM28HkonX`: `182:304` (Add package), `176:226` (main screen card)
- Prior slice: `context/archive/2026-11-16-first-medication-run-out/plan.md`, review finding F1 (server `today`)
- Patterns: `src/lib/medications/actions.ts`, `supabase/migrations/20261116185940_medications.sql`, `supabase/tests/database/medications_rls.test.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Stock rebasing and database

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 10a20fd
- [x] 1.2 Migration applies on a clean database: `npx supabase db reset` — 10a20fd
- [x] 1.3 RLS tests pass: `npx supabase test db` — 10a20fd
- [x] 1.4 Generated types are current: `npm run db:types` leaves `git status` clean — 10a20fd
- [x] 1.5 Lint passes: `npm run lint` — 10a20fd
- [x] 1.6 Production build passes: `npm run build` — 10a20fd

#### Manual

- [x] 1.7 The worked examples in `stock.test.ts` match the decided rule (12 + 30 on 8 Nov → 28 Nov; correct to 7 → 10 Nov; ran out + 30 → 30) — 10a20fd
- [x] 1.8 In Studio (http://127.0.0.1:55323) `medications` shows select, insert and update policies — 10a20fd

### Phase 2: Server actions

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 15ce7e9
- [x] 2.2 RLS tests still pass: `npx supabase test db` — 15ce7e9
- [x] 2.3 Lint passes: `npm run lint` — 15ce7e9
- [x] 2.4 Production build passes: `npm run build` — 15ce7e9

#### Manual

- [x] 2.5 Calling each action twice with the same expected baseline changes the stock once and returns the stale error the second time — 3348fe7

### Phase 3: Card dialogs and release

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — 3348fe7
- [x] 3.2 Lint passes: `npm run lint` — 3348fe7
- [x] 3.3 Production build passes: `npm run build` — 3348fe7
- [x] 3.4 RLS tests still pass: `npx supabase test db` — 3348fe7
- [x] 3.5 On the PR, `Lint and build` and `preview` succeed: `gh pr checks` — 3348fe7

#### Manual

- [x] 3.6 The add-package dialog matches mock `182:304` in English; for 18 tablets at 2/day counted today it shows "Now: 18 tabl. · 9 days", "+30", "extends by 15 days", "After adding: 48 tabl. · 24 days", and confirming moves the card to the right group — 3348fe7
- [x] 3.7 Editing the amount to 28 adds 28 and the next "+ Add package" pre-fills 30 again — 3348fe7
- [x] 3.8 "Correct count" to 7 on a 2/day medication shows 3 days; correcting to 0 shows "Ran out" and "No tablets left" at the top — 3348fe7
- [x] 3.9 A ran-out medication + one package shows the package size as tablets left — 3348fe7
- [x] 3.10 A double click adds the package once; submitting from a second, stale tab shows "The stock just changed…" and fresh numbers — 3348fe7
- [x] 3.11 Invalid amounts (0, 0.3, 1001, a result above 9999) show field errors and nothing is saved — 3348fe7
- [x] 3.12 Usable at 375 px and with keyboard only — 3348fe7
- [x] 3.13 Before the PR opened, `npx supabase db push --remote` applied the migration (dashboard shows the update policy) — 3348fe7
- [x] 3.14 On the PR preview, a real account can add a package and correct a count — 3348fe7
