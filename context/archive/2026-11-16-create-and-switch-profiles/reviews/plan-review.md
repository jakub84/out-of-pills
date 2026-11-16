<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Create and Switch Profiles

- **Plan**: context/changes/create-and-switch-profiles/plan.md
- **Mode**: Deep
- **Date**: 2026-11-16
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
8/8 paths ✓, 4/4 symbols ✓, brief↔plan ✓, Progress↔phases ✓; blast radius: all importers of TextField/AuthCard/button classes are inside files the plan already lists.

## Findings

### F1 — The cloud push in Phase 2 locks the schema two phases early

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, Progress 2.7; Critical Implementation Details
- **Detail**: "Never edit a pushed migration" combined with a push at the end of Phase 2 freezes the schema before onboarding and the main screen use it; only the Phase 4 PR preview needs the cloud schema.
- **Fix A ⭐ Recommended**: Move the push to Phase 4, right before the PR opens
  - Strength: Schema freezes after the UI has used it; one migration reaches production.
  - Tradeoff: Phase 2 ends locally verified only; Progress renumbered.
  - Confidence: HIGH — the preview is the first cloud reader.
  - Blind spot: None significant.
- **Fix B**: Keep the push in Phase 2 and allow editing the migration until merge
  - Strength: Cloud schema ready early.
  - Tradeoff: Requires manual cloud migration-history repair; breaks the plan's own rule.
  - Confidence: MED.
  - Blind spot: History repair not rehearsed.
- **Decision**: FIXED (Fix A) — Phase 2 manual 2.7 removed; Phase 4 §4 "Migration push and PR" and Progress 4.12 added, preview check is now 4.13; brief updated.

### F2 — Phase 3 changes `/` without listing the file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3, §3 Guards; criterion 3.8
- **Detail**: Guards on `/` and the post-create landing on `/?profile=<id>` need `src/app/page.tsx`, which still shows "No profiles yet" until Phase 4.
- **Fix**: Add `src/app/page.tsx` to Phase 3 with the redirects and a minimal "Profile: <name>" stub.
- **Decision**: FIXED — Phase 3 §5 "Interim main page".

### F3 — A profile without a caregiver row causes a redirect loop

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 create_profile(); Phase 3 §3 Guards
- **Detail**: `create_profile()` is callable via the API without a caregivers row; then `/onboarding/name` → `/` (has profile) → `/onboarding/name` (no caregiver) loops.
- **Fix**: `create_profile()` raises without a caregivers row (+ pgTAP case); onboarding redirects to `/` only with caregiver row AND ≥ 1 profile.
- **Decision**: FIXED.

### F4 — Some tool details in the plan are out of date

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1, Phase 2 §2–3, Phase 4 §1
- **Detail**: `gen types --local` deprecated and writes error JSON into the file when the stack is down; documented tests dir is `supabase/tests/database/`; authenticated-user simulation unspecified; shadcn Sidebar must not read its cookie under cacheComponents; shadcn init deps are `cn`, `radix-ui`, `tw-animate-css`.
- **Fix**: Update the contracts accordingly.
- **Decision**: FIXED.

### F5 — The update policy on profiles isn't needed yet

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 §1
- **Detail**: Nothing in S-02 updates profiles; S-08 should own and test the update policy.
- **Fix**: Select-only policy on profiles.
- **Decision**: FIXED.

### F6 — Each request checks the session several times

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §1 dal.ts
- **Detail**: `getCaregiver()` and `listProfiles()` each call `getCurrentUser()`, and header, sidebar and page call them again.
- **Fix**: Wrap the three DAL functions in React `cache()`.
- **Decision**: FIXED.
