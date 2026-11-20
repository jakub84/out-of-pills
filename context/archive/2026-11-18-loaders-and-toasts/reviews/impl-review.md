<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Page Loaders and Save Toasts

- **Plan**: context/changes/loaders-and-toasts/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 4 observations

Static review of `master...HEAD`, including the follow-up commits b5a73d9 and 196c31c. `npm run lint`, `npm test` (74 tests) and `npm run build` pass. The race and failure scenarios below were traced through the code and the installed Next.js source; they were not reproduced at runtime.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Retrying after a lost response creates a permanent duplicate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/feedback/run-save-action.ts:15
- **Detail**: Every rejected action is reported as "Couldn't save… try again", but a rejected request does not prove the save failed. `addMedication` (src/lib/medications/actions.ts:60) and `create_profile` (supabase/migrations/20261118124439_profile_avatars.sql:45) are plain inserts, no migration has a unique constraint, and the app has no delete action. If the insert commits and the connection drops before the response, the dialog stays open, the toast invites a retry, and the second row cannot be removed by the user.
- **Fix A ⭐ Recommended**: Change the toast to say the save could not be confirmed and to check the list first, and refresh the page data after a failed request.
  - Strength: Fits this change's "no database change" scope and stops the app from telling users to retry blindly.
  - Tradeoff: Reduces duplicates but does not make them impossible; the plan's agreed toast wording changes.
  - Confidence: MED — it depends on users reading the message, and the refresh also needs a connection.
  - Blind spot: Behaviour on a real flaky connection has not been tested.
- **Fix B**: Send a client-generated request id with each create and enforce it with a unique constraint in a new additive migration, treating a conflict as success.
  - Strength: Removes the duplicate class entirely.
  - Tradeoff: Needs a migration, RLS-aware RPC changes, pgTAP coverage and a cloud push; it is outside this plan.
  - Confidence: HIGH — standard idempotency pattern.
  - Blind spot: Retention of used request ids has not been designed.
- **Decision**: FIXED via Fix A, wording only. The automatic refresh was dropped because `router.refresh` falls back to a full page load when the fetch fails, which would discard the open dialog's values. Duplicates remain possible if a user retries without checking.

### F2 — Non-network failures are reported as connection problems

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/feedback/run-save-action.ts:17
- **Detail**: `unstable_rethrow` passes through only Next.js control-flow errors. `UnrecognizedActionError`, "An unexpected response was received from the server" (next/dist/client/components/router-reducer/reducers/server-action-reducer.js:105,140) and exceptions thrown by an action all produce the connection toast, and nothing is logged. A tab left open across a deployment would fail every save with advice that cannot help. The plan's Migration Notes accept that such a tab may need a refresh, but the user is never told so.
- **Fix**: Detect `unstable_isUnrecognizedActionError` (exported by `next/navigation`) and show a "new version, reload the page" toast, `console.error` other failures, and add tests for both.
  - Strength: Gives the one recoverable case the right instruction and makes other failures diagnosable.
  - Tradeoff: Adds one message and relies on an `unstable_` API, as `unstable_rethrow` already does.
  - Confidence: HIGH — the export is present in the installed Next.js types.
  - Blind spot: Whether Vercel skew protection is enabled is not visible from the repo.
- **Decision**: FIXED

### F3 — Signing out keeps the previous user's page state in the tab

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/sidebar-account.tsx:25
- **Detail**: `signOut` ends in a soft `redirect("/sign-in")` (src/app/(auth)/actions.ts:198). With `cacheComponents`, hidden routes keep their state, and the Next.js guide says state survives authentication changes and recommends a full page load for logout (node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md, "State and authentication"). `useSavedFormReset` deliberately keeps unsaved drafts, so a draft on `/profiles/new` could reappear for the next person signing in on the same tab. The header menu already behaved this way; this branch adds a second, always visible entry point.
- **Fix**: Make every sign-out finish with a full page load to `/sign-in`, using one shared control or route handler.
  - Strength: Follows the framework's documented guidance and clears all client state.
  - Tradeoff: Sign-out no longer stays a pure Server Component form if done on the client.
  - Confidence: HIGH — documented behaviour.
  - Blind spot: How many entries survive before eviction was not measured.
- **Decision**: FIXED via a POST route at `/auth/sign-out` with a 303 redirect, used by all three sign-out forms; the `signOut` server action was removed.

### F4 — "Add new" during post-save navigation can leave the form stuck on "Creating…"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/profiles/profile-form.tsx:123
- **Detail**: `isSubmitting` stays true while `state.status === "success"` and clears only when the page is hidden. While the navigation to the new profile is pending, `ProfileNav` treats `/` as current, so "Add new" is a live link. Clicking it discards the pending navigation, the router stays on `/profiles/new`, the page is never hidden, and the old form returns filled in with submit disabled.
- **Fix**: Tie the post-save guard to the pending navigation and reset the form when navigation ends on the same route.
  - Strength: Keeps the duplicate-submit guard and removes the dead end.
  - Tradeoff: Slightly more logic in `useSavedFormReset`.
  - Confidence: MED — traced through router code, not reproduced.
  - Blind spot: The same path on the password form has no in-page link, so it was not analysed further.
- **Decision**: FIXED in `useSavedFormReset`: the form remounts when the navigation ends with the page still shown. The duplicate-submit guard is unchanged. Not reproduced at runtime.

### F5 — Text below WCAG AA contrast

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/app-shell/sidebar-account.tsx:31
- **Detail**: "Sign out" uses `--primary` #37968a on white at 3.56:1, the white label on primary buttons is also 3.56:1, and the reduced-motion "Loading…" text (#737373 on #f5f5f5, src/components/navigation/page-loader.tsx:55) is 4.35:1. AA requires 4.5:1 for this text. The green Sign out was an explicit user request, and the user also asked for WCAG-compliant text colours.
- **Fix A ⭐ Recommended**: Darken `--primary` to #2c7a70 and use `text-brand-subtle` for "Loading…".
  - Strength: Keeps the green Sign out and also fixes every primary button: 5.09:1 with white, 4.67:1 on the page background.
  - Tradeoff: Changes the brand colour across the app and departs from the Figma token.
  - Confidence: HIGH — ratios computed from the token values.
  - Blind spot: The new shade has not been reviewed visually on all screens.
- **Fix B**: Change only "Sign out" to `text-brand-ink` and "Loading…" to `text-brand-subtle`.
  - Strength: Small and leaves the brand colour alone.
  - Tradeoff: Sign out stops being green, and primary buttons stay below AA.
  - Confidence: HIGH — local class changes.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix B. White text on primary buttons remains 3.56:1, below AA, by the user's choice to keep the brand colour.

### F6 — Plan no longer describes what shipped

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/loaders-and-toasts/plan.md:20
- **Detail**: Plan lines 20, 139 and 184, plan-brief.md:28 and Progress 2.5 still say bottom right. The loader is 72 px rather than 6em (src/components/navigation/page-loader.tsx:21). Not recorded in the plan: the header progress bar, bounce animation, close button, `pointer-events-auto`, `useSavedFormReset`, controlled password fields that now keep values after errors, the narrower `PendingLink` props, the empty-state redesign and the sidebar account footer. AGENTS.md does not list the account footer.
- **Fix**: Add an "Implementation addendum" to the plan listing these deviations, and mention the account footer in AGENTS.md.
- **Decision**: FIXED

### F7 — Closing a dialog during a save loses the draft or the error

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/medications/add-medication-dialog.tsx:61
- **Detail**: Dialogs can be closed while a save is pending, which unmounts the form. A failed request then says "try again" with the draft gone, and an inline server error has nowhere to appear.
- **Fix**: Block Escape, outside click and Cancel while the save is pending.
- **Decision**: FIXED with `useSaveGuard` in all three medication dialogs; Cancel is also disabled while saving.

### F8 — Sign out rebuilds the link variant at the call site

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/app-shell/sidebar-account.tsx:27
- **Detail**: `variant="ghost"` is overridden with `text-primary hover:bg-transparent hover:text-primary hover:underline`, while `link` in src/components/ui/button.tsx already provides this. AGENTS.md asks for variants to be changed in `src/components/ui`.
- **Fix**: Use `variant="link"` and keep only the layout and icon-rail classes.
- **Decision**: FIXED; `text-brand-ink` stays from F5.

### F9 — Creating a profile renders the server tree twice

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/profiles/actions.ts:90
- **Detail**: `revalidatePath` followed by a returned result renders the current page into the action response, and the client then fetches the destination. This adds reads on an infrequent action; the result stays correct.
- **Fix**: Accept for now and revisit if profile creation feels slow.
- **Decision**: ACCEPTED — infrequent action with a correct result.

### F10 — The loader may not be announced by screen readers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/navigation/page-loader.tsx:8
- **Detail**: The `role="status"` region and its text are inserted together, and many screen readers announce only changes to a region that already exists. This has not been tested with a screen reader.
- **Fix**: Test with NVDA or VoiceOver; if silent, keep an empty status region mounted and insert the text when loading starts.
- **Decision**: ACCEPTED — the user will check it with a screen reader; no code change yet.
