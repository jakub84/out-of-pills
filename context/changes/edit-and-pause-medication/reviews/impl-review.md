<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Edit and Pause a Medication

- **Plan**: context/changes/edit-and-pause-medication/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated: `npm test` (104), `npm run lint`, `npm run build`, `npx supabase test db` (104 pgTAP) all pass; generated types start with `export type` and include `paused_on`. All manual items confirmed by the user during implementation.

## Findings

### F1 — Pause/resume dialog can't recover from a stale error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/medications/pause-medication-dialog.tsx:67
- **Detail**: `const [shown] = useState(medication)` freezes the medication when the dialog opens, and `BaselineFields` always sends that frozen baseline. After a STALE_ERROR the page revalidates but `shown` never updates, so every retry fails the same way until the dialog is closed and reopened. If the medication was paused or resumed in another tab, the dialog also keeps offering the wrong direction.
- **Fix**: Freeze only on success: `const [frozen, setFrozen] = useState<StockDialogMedication | null>(null); const shown = frozen ?? medication;`, and call `setFrozen(shown)` before `onSaved()`. Retries then use the fresh baseline and the correct direction, and the dialog still can't flip while it closes.
- **Decision**: FIXED

### F2 — Retrying an edit after a stale error can overwrite another change

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/medications/edit-medication-dialog.tsx:115-127
- **Detail**: The draft (name, package size, dose) is seeded once from the medication at open. `BaselineFields` uses the live `medication` prop, so after a stale error and revalidation the retry carries the fresh baseline and passes the guard, while still sending the old draft values. Example: a rename started before another tab changed the dose writes the old dose back.
- **Fix A ⭐ Recommended**: Freeze the baseline the draft was seeded from. On a stale error, re-seed the draft fields the user hasn't touched, plus the baseline, from the fresh `medication`, and keep the stale alert visible so the user sees the new values before retrying.
  - Strength: no lost update, and the user's own edits are kept; this extends the guard idea of the S-06 plan.
  - Tradeoff: needs per-field "touched" tracking in the draft; a moderate amount of dialog code.
  - Confidence: MED — the pattern is clear, but the edit dialog is 370 lines and the touched tracking needs care.
  - Blind spot: whether users ever hit this; it needs two tabs or two caregivers.
- **Fix B**: On a stale error, close the dialog and show an error toast, so the user reopens it with fresh values.
  - Strength: tiny change, and the next save can never be based on stale data.
  - Tradeoff: throws away the user's edits, and moves the error out of the dialog, against the "errors stay inline" rule.
  - Confidence: HIGH — simple, local change.
  - Blind spot: none significant.
- **Decision**: FIXED (Fix A)

### F3 — A rename or package-size-only edit still resets the count to today

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/medications/actions.ts:194-201, src/lib/medications/stock.ts:209-214
- **Detail**: Every edit writes `pills_counted = L` and `counted_on = today`, even when the dose doesn't change. On a medication that is still in stock the figures stay the same, so this is safe. On one that has already **run out**, the count becomes 0 dated today, so `lastCoveredDay` becomes null: the card's "ran out on X" tile changes to "–" and its place in the red group changes. A pure rename can also fail with the stale error after someone else's restock, or with the day-changed error around midnight, although it doesn't need a new count.
- **Fix A ⭐ Recommended**: Test-first in `stock.ts`: when the dose doesn't change and pills left are in auto mode, `editStock` returns the input unchanged, so `guardedUpdate` writes only `name` and `package_size` and the trigger doesn't fire.
  - Strength: keeps the ran-out history; a rename no longer depends on the day or on the stock.
  - Tradeoff: one more branch in `stock.ts` and its tests; the edit preview must follow the same rule (it already calls `editStock`).
  - Confidence: HIGH — `guardedUpdate` already writes only the columns that changed, and a pgTAP test already allows a rename without a new count.
  - Blind spot: whether a package-size-only edit should ever re-date the count. I think not.
- **Fix B**: Accept the behaviour and note it in the plan.
  - Strength: no code change.
  - Tradeoff: a run-out medication loses its date after a rename.
  - Confidence: HIGH.
  - Blind spot: none significant.
- **Decision**: FIXED (Fix A)

### F4 — The edit stepper can start from a stale "today" and save it as a manual count

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/medications/edit-medication-dialog.tsx:139-143
- **Detail**: Auto mode is recomputed by the server, so a dialog left open past midnight is harmless there. But the +/- stepper starts from `autoPills`, computed with the page's `today`, and one click switches to manual, which the server saves as typed. A dialog opened at 23:55 and stepped and saved at 00:01 includes yesterday's dose, so the date ends up about one day later than the real one. The window is narrow.
- **Fix**: Send the dialog's `today` as a hidden field. In manual mode, `editMedication` returns DAY_CHANGED_ERROR when it differs from `todayInWarsaw()`.
- **Decision**: FIXED

### F5 — The database doesn't enforce the rebase maths

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261120113017_medications_edit_and_pause.sql:37-45
- **Detail**: When `counted_on` is already today, a signed-in client can change `daily_dose` or `paused_on` without recalculating `pills_counted`. This only affects the caller's own data (RLS), and the maths deliberately lives in `stock.ts`. The migration comment doesn't say so.
- **Fix**: Add one line to the migration's header comment ("the trigger enforces same-day rebasing, not the amounts; the maths lives in stock.ts"). The migration hasn't been pushed yet, so editing it is still allowed.
- **Decision**: FIXED

### F6 — Small unplanned changes not recorded in the plan

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/tests/database/medications_rls.test.sql:84-89; src/lib/medications/actions.ts:198-199; pause-medication-dialog.tsx; edit-medication-dialog.tsx
- **Detail**: All harmless, but missing from the plan:
  - The RLS test's "B cannot update A's medications" check now expects 0 matched rows, because of the new `name` grant.
  - `daily_dose` and `paused_on` are written only when they change.
  - Extra wording: the resume dialog's description, the paused hint in Edit, the " · Paused" suffix, and the preview labels.
- **Fix**: List these in the PR description under "Deviations from the plan".
- **Decision**: FIXED (list below)

## Deviations from the plan (for the PR description)

- `supabase/tests/database/medications_rls.test.sql`: "B cannot update A's medications" now asserts 0 matched rows instead of a 42501 error, a consequence of the new `name` / `daily_dose` / `paused_on` update grant (RLS still isolates caregivers).
- `actions.ts` guarded update writes `daily_dose` / `paused_on` only when the rebase changes them, so restock and correction send the same update as before.
- `OverviewItem` / `StockDialogMedication` carry `pausedOn` from Phase 3 (planned for Phase 4) so restock and correction could send the full baseline.
- `PACKAGE_OPTIONS` / `DOSE_OPTIONS` moved from `medication-details-step.tsx` to `medication-draft.ts` for reuse by the edit dialog.
- Extra wording: the resume dialog's description ("Stock starts decreasing again from today, with today as the first day."), the paused hint in Edit, " · Paused" in the edit dialog's description, the preview labels "Stays at" / "After resuming" / "After saving", the button "Save changes", and "Paused since" in short en-GB format.
- Review fixes:
  - F1: the pause dialog uses the live medication until a save succeeds.
  - F2: the edit dialog sends the baseline its form was filled from, and refills untouched fields after a stale error.
  - F3: an edit with the same dose and no typed count keeps the stored stock.
  - F4: a typed count after midnight is refused with the day-changed error.
  - F5: the migration comment says the database enforces the day, not the amounts.

## Triage summary

- Fixed: F1, F2 (Fix A), F3 (Fix A), F4, F5, F6
