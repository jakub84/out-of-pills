<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Profile Avatars Implementation Plan

- **Plan**: context/changes/profile-avatars/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 2 observations

Reviewed range: `88bbfe8..2613eef`. Re-run for this review and passing: `npm test` (65), `npx supabase test db` (89), `npm run db:types` (no diff), `npm run lint`, `npm run build`, avatar asset check, remote migration dry run (up to date). `npx supabase db reset` was not re-run because it would wipe local data; it passed during Phase 1 and after the deliberate-break check. Findings F1 to F4 and F7 come from reading code and CSS, and were not reproduced in a browser.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Long names lose their ellipsis on running-out profiles

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/profile-nav.tsx:75
- **Detail**: `SidebarMenuButton` truncates only `[&>span:last-child]` (`src/components/ui/sidebar.tsx:469`). When `runningOut` is true, the screen-reader span becomes the last child, so the name is no longer truncated and a long name is clipped by the button. Check 2.7 (40-character name) was done before the dot was added.
- **Fix**: Move `, running out` inside the name span.
- **Decision**: PENDING

### F2 — A medication query failure now takes down every signed-in page

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/app-sidebar.tsx:47
- **Detail**: `listAllMedications` throws on a query error and `src/app` has no `error.tsx`. The sidebar dot is decorative, but it makes pages such as `/profiles/new`, which did not load medications before, depend on that query.
- **Fix**: Catch the failure in `SidebarProfiles`, log it with `console.error`, and render the profiles without dots.
  - Strength: The profile list and `/profiles/new` keep working when only the dot's data is missing.
  - Tradeoff: During a failure a missing dot looks like "nothing urgent"; the main page still fails loudly.
  - Confidence: HIGH — the throw and the missing error boundary were confirmed in the code.
  - Blind spot: How Next renders this failure was not reproduced.
- **Decision**: PENDING

### F3 — The dot can be out of date in a tab left open past midnight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/app-sidebar.tsx:48
- **Detail**: The date is computed in the layout, which is preserved when switching profiles. After Warsaw midnight the dot can stay missing while the main page already shows the profile as running out. It corrects on reload or after any medication change.
- **Fix A ⭐ Recommended**: Accept this for now and handle it with S-09
  - Strength: No extra client code before the deadline; the main page, which is the authoritative view, stays correct after navigation.
  - Tradeoff: The dot can lag by up to one day boundary in a long-open tab.
  - Confidence: MEDIUM — follows from layout preservation, not observed at runtime.
  - Blind spot: How often caregivers keep a tab open overnight.
- **Fix B**: Call `router.refresh()` when the tab becomes visible and the Warsaw date has changed
  - Strength: Removes the staleness.
  - Tradeoff: Adds a client effect to the shell for a decorative marker.
  - Confidence: MEDIUM — standard approach, not yet tried here.
  - Blind spot: Effect on open dialogs during a refresh.
- **Decision**: PENDING

### F4 — Keyboard focus is not visible on colour swatches

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/profiles/profile-form.tsx:239-242
- **Detail**: The focused swatch is always the selected one, and its focus outline occupies the same 2-5 px band as the selection ring. `--ring` and `--primary` are the same colour (`#37968a`), so focus adds no visible change. The classes predate this change, but the plan requires keyboard use of the form.
- **Fix**: Give focus a distinct indicator, such as a solid `outline-foreground` at a larger offset.
- **Decision**: PENDING

### F5 — The closing commit has not reached the PR on GitHub

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: PR #23
- **Detail**: The branch on GitHub is at `2613eef`, but PR #23 still reports head `6cafc2c` and no CI run exists for `2613eef`. The green checks therefore cover `6cafc2c`. Merging in this state could leave out the plan close-out.
- **Fix**: Before merging, confirm the PR head matches the branch and the checks are green; if it stays behind, push a new commit (review fixes would do this).
- **Decision**: PENDING

### F6 — Additions are not recorded in the docs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: AGENTS.md (Project Structure); context/changes/profile-avatars/plan.md; context/foundation/roadmap.md:53
- **Detail**: The user-requested header illustration, sidebar dot, picker redesign and square avatar appear only in commits and the PR text. AGENTS.md lists only `listMedications()` and omits `stock-illustration`. The roadmap does not say that S-09 is partly delivered by the red dot. The comment at `app-sidebar.tsx:15` still says "S-02 parts only".
- **Fix**: Update AGENTS.md and the sidebar comment, add a note to `change.md`, and note the red dot under S-09.
- **Decision**: PENDING

### F7 — Low contrast on the dot and the avatar focus ring

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/profile-nav.tsx:70; src/components/profiles/profile-form.tsx:285
- **Detail**: The 7 px dot (`#f07777`) has no separating edge and about 2.8:1 contrast on white, lower on the rose avatar colour. The avatar focus ring uses `ring-ring/50`, about 1.8:1 on white. Both are below the 3:1 target for non-text elements. The dot colour matches the Figma design.
- **Fix**: Add a thin sidebar-coloured ring around the dot and use a solid focus ring colour.
- **Decision**: PENDING

### F8 — The default "No avatar" option is blank until a name is typed

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/profiles/profile-form.tsx:300-307
- **Detail**: The plan says this option shows the letter. With no name there is no letter, and visible labels were removed at the user's request, so the default selection is a plain coloured circle. Screen readers still hear "No avatar".
- **Fix**: Show a neutral icon in the circle while the name is empty.
- **Decision**: PENDING
