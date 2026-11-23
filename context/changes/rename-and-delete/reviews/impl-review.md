<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Rename and Delete Profiles and Medications

- **Plan**: context/changes/rename-and-delete/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-20
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Every planned item is implemented as specified, with no drift and nothing missing. Automated checks were re-run during the review, and all passed:

- `npm test`: 115 tests.
- `npm run lint`: pass.
- `npm run build`: pass.
- `npx supabase test db`: 140 tests.
- `database.types.ts`: starts with `export type` and includes `delete_profile`.

All manual checks are ticked, and 4.9 was confirmed on the Vercel preview.

Extras that strengthen the plan:

- `delete_profile` returns early when the caller held no membership (`if not found`). Without it, any signed-in user could delete a profile that already has no caregivers.
- pgTAP adds assertions beyond the contract: a null `auth.uid()`, an already-deleted profile, `policies_are`, and anon updates.
- `updateProfile` also rejects a malformed UUID.

## Findings

### F1 — Concurrent detach can orphan a shared profile

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261120133259_rename_and_delete.sql:84-97
- **Detail**: Under READ COMMITTED, suppose two caregivers of one profile call `delete_profile` at the same time. Each `not exists (… profile_caregivers …)` still sees the other's uncommitted membership row, so neither deletes the profile. It is left with no caregiver, and it and its medications become unreachable. This can't happen in v1, because `create_profile` links only the caller and sharing (FR-016) does not exist yet. The migration is already pushed, so a fix needs a new additive migration.
- **Fix A ⭐ Recommended**: Record a follow-up for the sharing slice. Lock the profile row (`perform 1 from public.profiles where id = p_profile_id for update;`) before deleting the membership.
  - Strength: no extra migration or remote push before this merge, and the race is unreachable until sharing ships.
  - Tradeoff: a known latent bug stays in the function until then.
  - Confidence: HIGH — v1 has exactly one caregiver per profile (`create_profile`).
  - Blind spot: whether anyone inserts `profile_caregivers` rows by hand in the cloud project.
- **Fix B**: Add a new additive migration with the `for update` lock now, plus a pgTAP note, and push it before merge.
  - Strength: closes the hole permanently, before anything depends on it.
  - Tradeoff: another migration, another remote push and another release step for a path no user can reach today.
  - Confidence: MEDIUM — two-session concurrency is hard to prove with pgTAP, so the fix would be reasoned rather than tested.
  - Blind spot: lock ordering against other future writers to `profiles`.
- **Decision**: FIXED via Fix A — deferred to the sharing slice in `follow-ups/review-fixes.md` (F1)

### F2 — Delete dialog copy assumes the caller is the last caregiver

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/delete-profile-dialog.tsx:28-33
- **Detail**: The dialog says "This deletes the profile and its N medications. This can't be undone." On a shared profile, `delete_profile` would only detach the caller, so the copy would be wrong. It is accurate in v1, where there is one caregiver per profile.
- **Fix**: Note it with F1 for the sharing slice (FR-016), and switch the copy to "leave" when other caregivers remain.
- **Decision**: FIXED — added to the sharing-slice follow-up in `follow-ups/review-fixes.md` (F2)

### F3 — app-shell dialog borrows a medications-internal hook and copies the dialog class

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/app-shell/delete-profile-dialog.tsx:6, 52
- **Detail**: It imports `useSaveGuard` from `@/components/medications/use-save-guard` and repeats `STOCK_DIALOG_CONTENT_CLASS` (`stock-dialog-parts.tsx:42`) inline. As a result, `app-shell` now depends on medications internals, and the dialog sizing lives in two places.
- **Fix**: Move `useSaveGuard` and a shared dialog content class to a neutral spot (e.g. `src/components/dialogs/`), and import them from both features.
- **Decision**: FIXED — `useSaveGuard` moved to `src/components/dialogs/use-save-guard.ts`; `STOCK_DIALOG_CONTENT_CLASS` replaced by `FORM_DIALOG_CONTENT_CLASS` in `src/components/dialogs/form-dialog.ts`, used by all seven dialogs; AGENTS.md lists the new folder

### F4 — Plan-external changes on the branch

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/ui/dropdown-menu.tsx; supabase/tests/database/medications_update.test.sql
- **Detail**: Two changes on the branch were not in the plan:
  - The dropdown padding, requested during manual testing. It is global, so it changes the user menu and the medication menu too.
  - The `policies_are` update in `medications_update.test.sql`, which the new delete policy required.

  Both are benign, and the PR's "Deviations" section lists the padding.
- **Fix**: No change needed. Optionally mention the `medications_update` test in the PR description.
- **Decision**: FIXED — PR #30 Deviations now mentions `medications_update.test.sql`
