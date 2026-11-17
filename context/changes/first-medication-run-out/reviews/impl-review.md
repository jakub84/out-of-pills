<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Medication Run-Out

- **Plan**: context/changes/first-medication-run-out/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria evidence: `npm test` 39/39, `npm run lint` clean, `npx supabase test db` 49/49, `npm run db:types` leaves the tree clean, PR #7 `Lint and build` + `preview` pass on 4285663. All manual rows were confirmed by the user during implementation.

## Findings

### F1 — Wizard preview dates come from the browser clock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/medications/add-medication-dialog.tsx:86
- **Detail**: `useState(() => todayInWarsaw())` runs in the browser, so a device clock running a day or more fast moves the "Runs out on …" date in the step-1 preview and the review step later than the real one, against the "never later" guardrail. The saved row and the overview are unaffected (`counted_on` is stamped by the database, the overview computes on the server). A dialog left open past midnight only shifts the date earlier, which is safe.
- **Fix**: Pass the server's `today` (already computed in `SelectedProfile`, `src/app/(app)/page.tsx`) into `AddMedicationDialog` as a prop and use it instead of the client clock.
- **Decision**: FIXED — server `today` passed as a prop (server date only; a later "today" means a later preview date, so the browser date is not mixed in).

### F2 — Extra "0.5" tablets-per-day chip

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/medications/medication-draft.ts:11
- **Detail**: `DOSE_CHIPS = ["0.5", "1", "2", "3"]`; the plan (Phase 3 #2) and mock `177:601` specify 1 / 2 / 3 / Other. 0.5 is a valid dose and the default is still 1, so this is harmless, but it isn't in the plan.
- **Fix**: Keep it and record it in the plan as an accepted deviation, or drop the "0.5" entry so the chips match the mock (0.5 stays reachable via Other).
- **Decision**: ACCEPTED — keep the 0.5 chip as a deliberate deviation from the mock; noted on PR #7.

### F3 — Small unplanned layout deviations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/app/(app)/page.tsx:109; src/app/(app)/profiles/new/page.tsx:14
- **Detail**: (a) On an empty profile the "Add medication" button next to the "Medication stock (0)" heading is hidden, so only the empty-state card's button shows (Phase 3 #3 asked for both; done to avoid two identical buttons). (b) `mx-auto` was added to the "Add a profile" page wrapper so it centres like `/`. Both are deliberate and harmless.
- **Fix**: No code change; note both in the PR description.
- **Decision**: FIXED — both deviations listed in the PR #7 description.

### F4 — Insert failures are not logged

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/medications/actions.ts:48
- **Detail**: Every Supabase insert error (RLS 42501 for a foreign profile, malformed uuid, check violation, network) becomes "Something went wrong" with nothing logged, so production failures are invisible. Matches the existing `profiles/actions.ts` pattern, so it's not a new deviation.
- **Fix**: `console.error("addMedication insert failed", error)` before returning the generic message (Vercel captures server logs).
- **Decision**: FIXED — `console.error` added in `addMedication` before the generic message.
