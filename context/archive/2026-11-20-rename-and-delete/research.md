---
date: 2026-11-20T13:58:26+01:00
researcher: Claude
git_commit: 1fde044
branch: master
repository: out-of-pills
topic: "S-08 rename-and-delete: rename a profile, change or remove its avatar, delete a profile with its medications, delete a single medication — each deletion after a confirmation"
tags: [research, profiles, medications, supabase, rls, s-08]
status: complete
last_updated: 2026-11-20
last_updated_by: Claude
---

# Research: Rename and delete profiles and medications (S-08)

**Date**: 2026-11-20T13:58:26+01:00
**Researcher**: Claude
**Git Commit**: 1fde044
**Branch**: master
**Repository**: out-of-pills

## Research Question

Roadmap S-08 (FR-004, FR-005, FR-013, FR-022): what does the current code need so a caregiver can rename a profile, change or remove its avatar, delete a profile together with its medications, and delete a single medication, each deletion after a confirmation? Which contracts (schema, RLS, grants, functions, server actions, UI, toasts, tests) are affected, and which product choices remain open?

## Summary

- **The database blocks every S-08 write today, by design.** `profiles` has only a select policy and only a `select` grant for `authenticated` (`supabase/migrations/20261116165228_profiles.sql:69-80, 90`); the comment at line 69 says "Rename and delete policies arrive with S-08". `profile_caregivers` has only a select policy and `select` grant (`…profiles.sql:64-67, 91`). `medications` has select, insert and update policies but no delete policy and no `delete` grant (`20261116185940_medications.sql:34-57, 64-68`; `20261117120803_medications_stock_updates.sql:8-30`). S-08 needs one new additive migration.
- **Profile deletion must be "the last caregiver detaches", not a plain `DELETE` on `profiles`.** The PRD Access Control rule (`context/foundation/prd.md:149`) and FR-005's resolution (`prd.md:85`) and the roadmap risk (`context/foundation/roadmap.md:193`) all say so. The data model already supports it: ownership lives in `profile_caregivers` (`…profiles.sql:35-36, 52-57`), and `profiles → medications` and `profiles → profile_caregivers` are `on delete cascade` (`…medications.sql:11`, `…profiles.sql:53`). The existing pattern for multi-table writes is a `security definer` function that only ever acts on `auth.uid()` (`create_profile`, `…profiles.sql:97-128`; `20261118124439_profile_avatars.sql:21-57`). A `leave_profile(p_profile_id)`-style function — delete the caller's membership, then delete the profile if no membership remains — matches that pattern and keeps the "no user can delete data for others" rule (`prd.md:149`) true once sharing (FR-016) arrives.
- **Rename and avatar change are a column-scoped update.** Following the S-06/S-07 precedent of column grants (`20261117120803_…:30`, `20261117131550_…:7`, `20261120113017_…:26`), S-08 needs an update policy on `profiles` scoped by membership plus `grant update (name, avatar[, avatar_color]) on profiles`. Existing check constraints already enforce the name length (`…profiles.sql:40`), colour set (`…profiles.sql:42-43`) and avatar-per-kind rule (`…profile_avatars.sql:5-13`) on update as on insert. `kind` is not in FR-004/FR-022, and the avatar constraint ties `avatar` to `kind`, so changing `kind` is an open product question (see Open Questions).
- **Medication deletion is a plain delete under RLS.** A delete policy with the same membership `exists` used by select/insert/update (`…medications.sql:35-57`) plus `grant delete on medications to authenticated`. The `medications_stock_counted_today` trigger is `before update` only (`20261117120803_…:54-57`), so it does not affect deletes.
- **Two existing pgTAP assertions encode today's "no access" state and will change meaning.** `profiles_rls.test.sql:77-82` expects B's update of A's profile to throw `42501` (no grant); once `update` is granted, RLS hides the row and the statement succeeds with 0 rows — the same shift S-07 made for medications (`medications_rls.test.sql:84-90`). `medications_rls.test.sql:91-96` expects B's delete to throw `42501`; with a delete grant it becomes a 0-row delete. Both tests must be rewritten (lives_ok + ground-truth check), not deleted.
- **App code has no edit/delete paths yet; the UI hooks are in place.** The medication "⋯" menu already renders a disabled "Remove" item reserved for S-08 (`src/components/medications/medication-options-menu.tsx:20-23, 57-60`) and owns a single `OpenDialog` state that new dialogs plug into (`:18, 25-34`). The sidebar profile rows have no menu (`src/components/app-shell/profile-nav.tsx:55-91`); the S-02 plan deferred "the `…` row menus" to S-08 (`context/archive/2026-11-16-create-and-switch-profiles/plan.md:40`). `ProfileForm` is create-only (see Detailed Findings).
- **Deleting the selected or the last profile already lands somewhere sensible without new routing:** an unknown `?profile=` id falls back to the oldest profile (`src/app/(app)/page.tsx:25-28`), and zero profiles redirects to `/onboarding/profile` (`page.tsx:55`; that page redirects back to `/` once a profile exists, `src/app/onboarding/profile/page.tsx:30`). Whether "no profiles left → onboarding" is the wanted UX is a product choice.

## Detailed Findings

### Database: profiles, memberships and their privileges

- Tables: `caregivers` (`…profiles.sql:9-14`), `profiles(id, name, kind, avatar_color, created_at)` (`:38-45`) plus `avatar` (`…profile_avatars.sql:5-13`), `profile_caregivers(profile_id → profiles on delete cascade, user_id → auth.users on delete cascade, pk(profile_id, user_id))` (`…profiles.sql:52-57`).
- RLS policies on `profiles`: one, select by membership (`:70-80`). On `profile_caregivers`: one, select own rows; the comment requires its policies to "only compare user_id and never query profiles" to avoid recursion (`:3-4, 63-67`). A future delete policy on `profile_caregivers` must keep that rule.
- Grants after `revoke all`: `profiles` → `select`; `profile_caregivers` → `select` (`:85-91`). The four-argument `create_profile` migration states "RLS and grants on profiles are unchanged" (`…profile_avatars.sql:1-2`); no later migration (inspected all six files in `supabase/migrations/`) grants update or delete on either table.
- Checks that will also guard updates: name 1–40 trimmed chars (`…profiles.sql:40`), `kind` set (`:41`), `avatar_color` set (`:42-43`), `profiles_avatar_matches_kind` (`…profile_avatars.sql:7-13`). The same rules are mirrored in `src/lib/profiles/validation.ts:9-73` (`PROFILE_KINDS`, `AVATAR_COLORS`, `AVATARS_BY_KIND`, `NAME_MAX_LENGTH = 40`, `validateProfileName`, `isAvatarForKind`).

### Database: medications delete

- `medications.profile_id → profiles on delete cascade` (`…medications.sql:11`); the existing test proves the cascade (`medications_rls.test.sql:174-182`, run as `postgres`).
- No delete policy (comment at `…medications.sql:34`: "Update and delete policies arrive with the slices that edit and remove medications") and no delete grant (`:64-68`). The S-07 research recorded the same gap: "No delete policy (S-08)" (`context/archive/2026-11-20-edit-and-pause-medication/research.md:65`).
- Trigger `medications_stock_counted_today` fires `before update` (`20261117120803_…:54-57`; body replaced in `20261120113017_…:35-63`); deletes are not affected.

### Profile deletion as "last caregiver detaches"

- Requirements: FR-005 (`prd.md:84-85`), NFR "a user can delete their own data" (`prd.md:130`), Access Control "each caregiver can only detach themselves from a profile; the profile is deleted when the last caregiver detaches" (`prd.md:149`), v1 single caregiver (`prd.md:151`), roadmap risk (`roadmap.md:193`).
- Two schema shapes satisfy it (inference; neither exists today):
  1. A `security definer` function (pattern of `create_profile`, `…profiles.sql:97-128`: `set search_path = ''`, `auth.uid()` null check raising `42501`, `revoke execute … from public, anon`, `grant execute … to authenticated`) that deletes `(p_profile_id, auth.uid())` from `profile_caregivers` and then deletes the profile when no memberships remain. Cascades remove the medications. One RPC call from the server action; no new table grants needed on `profiles`.
  2. A delete policy + grant on `profile_caregivers` (own row only, keeping the "never query profiles" rule) plus an `after delete` trigger that removes orphaned profiles. This also covers a user deleted from `auth.users` (whose memberships cascade away, `…profiles.sql:54`) — today such a profile would be left orphaned (inference from the FKs; not tested).
- Concurrency: in v1 one caregiver per profile, so "is this the last membership?" has no race worth a lock; with sharing (FR-016) two caregivers detaching at once could both see one remaining member. A `for update` on the profile row or a single `delete … where not exists (…)` statement avoids that (inference; out of v1 scope but cheap).
- A not-a-member or unknown `p_profile_id` should be a no-op or a distinct error, never a delete; the existing pattern surfaces RLS misses as the generic error (`src/lib/medications/actions.ts:39-43, 141-143`).

### Server actions and DAL

- `src/lib/profiles/actions.ts` has `saveDisplayName` (`:21-45`) and `createProfile` (`:48-92`) only. `createProfile` validates name/kind/colour/avatar with the shared helpers (`:55-73`), maps `P0001`/`42501` RPC errors to redirects (`:81-86`), and `revalidatePath("/", "layout")` so the sidebar refreshes (`:89-91`). Rename/avatar and delete actions would follow the same shape.
- `ProfileFormState.fieldErrors` already has keys `name | kind | avatarColor | avatar` (`src/lib/profiles/form-state.ts:5`), so an edit action can reuse it.
- `src/lib/medications/actions.ts` has no delete. Its writes use `guardedUpdate` with a stale-baseline check (`:136-234`) and the error constants `GENERIC_ERROR`, `STALE_ERROR`, `DAY_CHANGED_ERROR` (`:29-31`). A delete has no baseline to protect: deleting an already-deleted row returns 0 rows. Whether that is treated as success (idempotent) or as "already removed" is a choice; with `.select("id")` on the delete the action can tell the two apart, as `guardedUpdate` does for updates (`:210-229`).
- `listProfiles()` / `listMedications()` / `listAllMedications()` are `react` `cache`d per request and rely on RLS (`src/lib/profiles/dal.ts:50-70`; `src/lib/medications/dal.ts:52-86`). No DAL change is needed for S-08 beyond what the edit form must read (inference).

### UI: medication removal

- `MedicationOptionsMenu` (`src/components/medications/medication-options-menu.tsx:24-68`) renders "Remove" as `disabled variant="destructive"` with a `Trash2` icon (`:57-60`); dialogs are controlled by `dialogProps(name)` (`:29-34`). A `RemoveMedicationDialog` slots in as `"remove"` in `OpenDialog` (`:18`).
- The confirmation pattern to copy is `PauseMedicationDialog` (`src/components/medications/pause-medication-dialog.tsx:34-139`): `useSaveGuard` keeps the dialog open while saving (`use-save-guard.ts:11-27`), `runSaveAction` wraps the call (`pause-medication-dialog.tsx:79-82`), success shows `toast.success(...)` then closes (`:83-87`), server errors render inline in an `Alert` (`:115-119`), Cancel is a `DialogClose` (`:122-132`). `BaselineFields` (`stock-dialog-parts.tsx:121`) is not needed for a delete unless the plan wants a stale guard.
- The card renders the menu at `src/components/medications/medication-card.tsx:87`.

### UI: profile rename / avatar change / delete

- No entry point exists: sidebar rows are plain `PendingLink`s (`profile-nav.tsx:55-91`); the main page header shows avatar + "Profile: <name>" with no controls (`src/app/(app)/page.tsx:82-97`). Where the edit/delete controls live (sidebar row "⋯", page header, a `/profiles/<id>/edit` route) is an open product/design choice. The S-02 plan anticipated "the `…` row menus" (`context/archive/2026-11-16-create-and-switch-profiles/plan.md:40`; brief `plan-brief.md:30, 46`).
- `ProfileForm` (`src/components/profiles/profile-form.tsx:87-390`) is create-only in these ways: state starts from fixed defaults — kind `"me"`, empty name, colour `"mint"`, no avatar (`:124-128`); the success toast is hard-wired to `profileCreatedMessage` (`:113`); the submit button always shows a `Plus` icon and "Creating…" (`:377-386`); it resets via `useSavedFormReset` after navigating away (`:87-91`; `src/components/navigation/navigation-pending.tsx:77-102`); changing kind clears the avatar (`:169-174`). Reusing it for editing needs initial-value props and label/toast/icon variants, or a separate smaller edit form (name + colour + avatar grid for the stored kind). The avatar grid (`:300-353`) and `ProfileAvatar` (`src/components/profiles/profile-avatar.tsx`) are reusable as is.
- The S-11 plan chose "one profile-editing flow" delivered by S-08 for FR-022 (`context/archive/2026-11-18-profile-avatars/plan-brief.md:31`).

### Navigation after delete

- Selected profile resolution: `profiles.find(id === requested) ?? profiles[0]` (`page.tsx:25-28`), also used for the page title (`:30-34`) and mirrored client-side in the sidebar (`profile-nav.tsx:43-47`). After deleting the shown profile, staying on `/?profile=<deleted id>` would show the oldest remaining profile; navigating to `/` explicitly (via `navigate`, per AGENTS.md) makes it unambiguous.
- Zero profiles → `redirect("/onboarding/profile")` (`page.tsx:55`).

### Feedback wording

- `src/lib/feedback/messages.ts:1-52` holds every toast; there is no rename, avatar, profile-deleted or medication-removed message yet. AGENTS.md requires new successful data changes (explicitly naming "future edit and delete") to toast text from this file and run through `runSaveAction`. `messages.test.ts` covers the wording.

### Tests that S-08 touches

- `supabase/tests/database/profiles_rls.test.sql` (`plan(26)`, line 5): B-cannot-update assertion expects `42501` (`:77-82`); ground-truth "A's profile is unchanged" (`:145-149`) stays useful. New cases needed: A can rename / change avatar of own profile; avatar-per-kind and name checks on update; B's update/delete of A's profile changes nothing; leaving/deleting removes memberships, profile and medications; anon cannot execute the new function.
- `supabase/tests/database/medications_rls.test.sql` (`plan(23)`, line 5): B-cannot-delete expects `42501` (`:91-96`); becomes a 0-row delete plus ground truth. New case: A can delete own medication.
- `src/lib/profiles/validation.test.ts`, `src/lib/feedback/messages.test.ts` for new validation/wording. No change to `stock.ts` is implied by S-08 (inference: delete and rename do not touch run-out maths).

## Code References

- `supabase/migrations/20261116165228_profiles.sql:69` — "Rename and delete policies arrive with S-08"
- `supabase/migrations/20261116165228_profiles.sql:85-91` — grants: profiles/profile_caregivers select only
- `supabase/migrations/20261116165228_profiles.sql:97-128` — `create_profile` security-definer pattern
- `supabase/migrations/20261116185940_medications.sql:11` — medications cascade from profiles
- `supabase/migrations/20261116185940_medications.sql:34, 64-68` — no delete policy/grant
- `supabase/migrations/20261118124439_profile_avatars.sql:5-13` — avatar-per-kind constraint
- `src/lib/profiles/actions.ts:48-92` — `createProfile` (shape for new actions)
- `src/lib/medications/actions.ts:136-234` — `guardedUpdate` (0-row detection, revalidate)
- `src/components/medications/medication-options-menu.tsx:57-60` — disabled "Remove"
- `src/components/medications/pause-medication-dialog.tsx:34-139` — confirmation dialog pattern
- `src/components/profiles/profile-form.tsx:113, 124-128, 377-386` — create-only assumptions
- `src/components/app-shell/profile-nav.tsx:55-91` — sidebar rows, no menu
- `src/app/(app)/page.tsx:25-28, 55` — fallback selection, zero-profile redirect
- `supabase/tests/database/profiles_rls.test.sql:77-82` — assertion to rewrite
- `supabase/tests/database/medications_rls.test.sql:91-96` — assertion to rewrite

## Architecture Insights

- Privileges are opened per slice with column-level grants and membership-scoped policies; every slice so far added its own migration and adjusted the pgTAP "cannot" tests from `throws_ok 42501` to `lives_ok` + ground truth once a grant exists (S-07 example: `medications_rls.test.sql:84-90`).
- Multi-row or cross-table writes go through `security definer` functions bound to `auth.uid()`, never through the service-role key (AGENTS.md Hard Rules).
- Client dialogs: controlled by the card menu, guarded with `useSaveGuard`, wrapped in `runSaveAction`, toast on success, inline `Alert` on server error.
- Demo mode (S-10) does not exist yet; nothing in S-08 has to branch for it today, but the AGENTS.md rule "demo never writes to Supabase" will apply to these actions later.

## Historical Context (from prior changes)

- `context/archive/2026-11-16-create-and-switch-profiles/plan.md:40,136` — S-02 left out rename/delete and row "…" menus; "no insert, update or delete policy (rename/delete arrive with S-08, which adds and tests its own policies)". Supported by current migrations.
- `context/archive/2026-11-16-create-and-switch-profiles/reviews/plan-review.md:80` — "S-08 should own and test the update policy". Still open; supported.
- `context/archive/2026-11-18-profile-avatars/plan-brief.md:31, 46, 67` — avatar change/removal delivered with S-08 as one profile-editing flow; existing profiles keep their letter until then. Supported.
- `context/archive/2026-11-20-edit-and-pause-medication/plan.md:40` — "No separate 'discontinue' state: an indefinite pause covers it until S-08 adds removal." Supported; S-08 provides removal, pause remains separate (FR-013 resolution, `prd.md:110`).
- `context/archive/2026-11-20-edit-and-pause-medication/plan.md:275` — Remove "still disabled for S-08". Matches `medication-options-menu.tsx:57-60`.
- `context/archive/2026-11-18-loaders-and-toasts/reviews/impl-review.md:32` — noted that a retried insert could create a duplicate row "the user cannot remove" because "the app has no delete action". S-08 delete closes that gap for medications and profiles.

## Related Research

- `context/archive/2026-11-20-edit-and-pause-medication/research.md` — medication update grants, trigger and RLS state before S-08.

## Open Questions

1. **Entry point for profile edit/delete**: "⋯" menu on sidebar rows, controls in the main page header, a dedicated edit route, or a combination? (No mock reference found in the inspected repo docs.)
2. **Can the profile kind change?** FR-004/FR-022 don't require it; the avatar list depends on kind (`validation.ts:32-37`, DB check). Options: kind fixed (edit shows the stored kind's avatars), or kind editable (avatar cleared when kind changes, as in the create form `profile-form.tsx:169-174`).
3. **Is avatar colour editable?** Not named in FR-022, but it is part of the avatar look.
4. **Deletion function shape**: security-definer `leave/delete_profile` RPC vs. membership delete policy + orphan-cleanup trigger (the latter also covers deleted auth users).
5. **Deleting the last profile**: allow it and fall through to onboarding (`page.tsx:55`), or block it with a message?
6. **Confirmation strength for profile delete**: simple confirm dialog naming the profile and the number of medications, or type-the-name confirmation?
7. **Medication delete of an already-removed row**: treat 0 rows as success or show "already removed"?
8. **Toast wording** for rename, avatar change, profile deleted, medication removed (`messages.ts`).
