# Rename and Delete Profiles and Medications Implementation Plan

## Overview

Roadmap S-08 (FR-004, FR-005, FR-013, FR-022): a caregiver can edit a profile (name, type, avatar colour, avatar), delete a profile together with its medications, and remove a single medication. Each deletion goes through a confirmation dialog. Profile deletion follows the PRD Access Control rule: the caller detaches from the profile, and the profile is deleted when no caregiver is left (`context/foundation/prd.md:149`).

## Current State Analysis

- `profiles` and `profile_caregivers` are read-only for `authenticated`: one select policy each and `select` grants only (`supabase/migrations/20261116165228_profiles.sql:64-91`); line 69 reserves rename/delete policies for S-08.
- `medications` has select/insert/update policies but no delete policy or grant (`20261116185940_medications.sql:34-68`). Its trigger fires `before update` only (`20261117120803_medications_stock_updates.sql:54-57`).
- Deleting a profile cascades to `medications` and `profile_caregivers` (`…medications.sql:11`, `…profiles.sql:53`).
- `create_profile` is the pattern for a `security definer` function bound to `auth.uid()` (`…profiles.sql:97-128`, `20261118124439_profile_avatars.sql:21-57`).
- The avatar must match the kind (DB check `…profile_avatars.sql:7-13`, mirrored in `src/lib/profiles/validation.ts:32-56`).
- `createProfile` validates its fields inline (`src/lib/profiles/actions.ts:55-73`). `ProfileForm` is create-only: fixed initial state, a hard-wired "created" toast, a Plus icon and "Creating…" label (`src/components/profiles/profile-form.tsx:113, 124-128, 377-386`).
- The medication ⋯ menu has a disabled "Remove" item reserved for S-08 (`src/components/medications/medication-options-menu.tsx:57-60`). The pause dialog is the confirmation pattern (`pause-medication-dialog.tsx`).
- Sidebar rows are plain links with no menu (`src/components/app-shell/profile-nav.tsx:55-91`). The selection is computed only on `/` (`profile-nav.tsx:43-47`). The sidebar loads all medications for the red dots and falls back to `[]` on failure (`app-sidebar.tsx`, `loadMedicationsForDots`).
- Two pgTAP assertions expect `42501` where S-08 grants access: `profiles_rls.test.sql:77-82` (B updates A's profile) and `medications_rls.test.sql:91-96` (B deletes A's medications).
- Research: `context/changes/rename-and-delete/research.md`.

## Desired End State

- The active profile row in the sidebar shows a "⋯" (mock 176:226). Its dropdown offers "Edit profile" and "Delete profile".
- "Edit profile" opens `/profiles/<id>/edit`: the profile form pre-filled with name, type, colour and avatar. Saving shows "Profile <name> updated" and returns to that profile.
- "Delete profile" opens a "Delete <name>?" dialog that states how many medications go with it and that this can't be undone. Confirming shows "Profile <name> deleted" and lands on `/`. With no profiles left, the existing redirect opens the onboarding step for the first profile.
- The medication card's "Remove" opens a "Remove <name>?" dialog. Confirming shows "<name> removed". A medication already removed elsewhere is treated as removed (success).
- The database allows exactly these writes for the caller's own profiles. Another user's update or delete matches nothing. Verified by pgTAP and by manual checks on the Vercel preview.

### Key Discoveries:

- `create_profile` (`…profiles.sql:97-128`) is the template for `delete_profile`: `security definer`, `set search_path = ''`, a null-`auth.uid()` check raising `42501`, execute revoked from `public, anon`.
- `profile_caregivers` policies must never query `profiles` (recursion rule, `…profiles.sql:3-4, 63`). `delete_profile` avoids new policies on that table altogether.
- Unknown or foreign `?profile=` ids already fall back to the oldest profile, and zero profiles redirect to onboarding (`src/app/(app)/page.tsx:25-28, 55`).
- The shadcn `SidebarMenuAction` already hides itself in the collapsed icon rail (`src/components/ui/sidebar.tsx:543-567`, `group-data-[collapsible=icon]:hidden`).

## What We're NOT Doing

- No ⋯ on inactive sidebar rows, in the page header, or in the collapsed icon rail (mock shows it only on the active row).
- No "type the name" confirmation. No undo or soft delete. No trash or history (FR-018).
- No sharing or "leave a shared profile" UI (FR-016). `delete_profile` already behaves correctly for several caregivers, but v1 has one.
- No delete policy or grant on `profiles` or `profile_caregivers`: deletion goes only through `delete_profile`.
- No orphan clean-up for users deleted from `auth.users`.
- No changes to `stock.ts`, the run-out maths, or the caregiver's display name.
- No demo-mode branching (S-10 does not exist yet).

## Implementation Approach

Database first, then the UI in three thin vertical slices, each reusing an existing pattern:

- **Database:** one additive migration.
- **Removing a medication:** the pause dialog pattern.
- **Editing a profile:** `ProfileForm` in an edit mode, on a page that mirrors "Add a profile".
- **Deleting a profile:** a confirmation dialog in the sidebar.

All mutations are server actions run through `runSaveAction`, with toast text from `messages.ts`. Server errors show inline (AGENTS.md).

## Critical Implementation Details

- **Release order:** the migration must be pushed to the cloud project (`npx supabase db push --remote`, `--dry-run` first) before the PR is merged, because the deployed code calls `delete_profile` and relies on the new grants. Never edit the migration after the push.
- **The medication count in the delete dialog must not lie.** `loadMedicationsForDots` returns `[]` on failure, which would read as "0 medications". The count must be `null` when medications failed to load, and the dialog then says "and all its medications" without a number.

## Phase 1: Database privileges and `delete_profile`

### Overview

One additive migration opens profile updates, medication deletes and profile deletion, with pgTAP coverage and regenerated types.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_rename_and_delete.sql` (via `npx supabase migration new rename_and_delete`)

**Intent**: Let a caregiver edit their own profiles, delete their own profiles' medications, and delete a profile by detaching from it, without reaching anyone else's data.

**Contract**:
- `profiles` update policy for `authenticated`. `using` and `with check` use the same membership `exists` as the select policy (`…profiles.sql:70-80`). Plus `grant update (name, kind, avatar_color, avatar) on public.profiles to authenticated`. The existing checks (name, kind, colour, avatar-per-kind) apply to updates unchanged.
- `medications` delete policy for `authenticated`, using the same membership `exists` as the select policy (`…medications.sql:35-45`). Plus `grant delete on public.medications to authenticated`.
- `public.delete_profile(p_profile_id uuid) returns void`, `language plpgsql security definer set search_path = ''`:
  1. Raise `42501` when `auth.uid()` is null.
  2. Delete the caller's own `profile_caregivers` row for that profile.
  3. Delete the profile only `where not exists` any remaining membership.

  An unknown id, or a profile the caller doesn't belong to, deletes nothing and does not raise. That keeps "already gone" a success and never touches another caregiver's profile.
- Revoke execute on `delete_profile` from `public, anon`, and grant it to `authenticated`.
- Header comment: additive only, references S-08 / FR-004, FR-005, FR-013, FR-022, and the "last caregiver detaches" rule.

#### 2. pgTAP: existing assertions

**Files**: `supabase/tests/database/profiles_rls.test.sql`, `supabase/tests/database/medications_rls.test.sql`

**Intent**: The two `throws_ok 42501` assertions now describe a granted-but-hidden row. Rewrite them the way S-07 did (`medications_rls.test.sql:84-90`), keeping the ground-truth checks.

**Contract**:
- "B's update of A's profile" becomes `lives_ok` (matches no rows). The existing ground truth "A's profile is unchanged" (`profiles_rls.test.sql:145-149`) proves it.
- "B's delete of A's medications" becomes `lives_ok` (matches no rows), plus a ground-truth check that A's medication still exists.
- Adjust `plan(n)` counts.

#### 3. pgTAP: new behaviour

**File**: `supabase/tests/database/rename_and_delete.test.sql` (new)

**Intent**: Prove the new writes for the owner and their absence for others.

**Contract** — at least:
- A can update the name, kind, colour and avatar of their own profile.
- A blank name, a 41-character name, and an avatar that doesn't match the kind are rejected on update (`23514`).
- A cannot update `profiles.id` or `created_at` (`42501`).
- A can delete their own medication. B's delete of it changes nothing.
- B's `delete_profile(A's profile)` deletes nothing (A's profile, membership and medications remain).
- A's `delete_profile` removes the profile, its membership and its medications.
- `delete_profile` of an unknown id does not raise.
- With two caregivers on one profile (fixture inserted as `postgres`), the first `delete_profile` removes only that caregiver's membership and keeps the profile. The second removes the profile.
- anon cannot execute `delete_profile`. anon cannot delete medications.

#### 4. Types

**File**: `src/lib/supabase/database.types.ts`

**Intent**: Regenerate with `npm run db:types` so `delete_profile` is typed for `supabase.rpc`.

**Contract**: The file starts with `export type`. No hand edits.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies all migrations cleanly
- `npx supabase test db` passes, including `rename_and_delete.test.sql` and the rewritten assertions
- `npm run db:types` regenerates `database.types.ts` with `delete_profile` and the file starts with `export type`
- `npm run lint`, `npm test` and `npm run build` pass

#### Manual Verification:

- In local Studio, the new policies on `profiles` (update) and `medications` (delete) and the `delete_profile` function are visible, with RLS still enabled on every table

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Remove a medication

### Overview

Enable the "Remove" item on the medication card with a confirmation dialog (FR-013).

### Changes Required:

#### 1. Toast wording

**File**: `src/lib/feedback/messages.ts`, `src/lib/feedback/messages.test.ts`

**Intent**: Add the removal toast next to the other medication messages.

**Contract**: `medicationRemovedMessage(name)` returns `"<name> removed"` (e.g. "Aspirin removed"), with a test.

#### 2. Server action

**File**: `src/lib/medications/actions.ts`

**Intent**: Delete one medication of the caller's profiles. RLS scopes the row. 0 rows (already removed or not visible) counts as success.

**Contract**: `removeMedication(_prev: StockFormState, formData: FormData): Promise<StockFormState>`.
- Calls `getCurrentUser()` first.
- Reads `medicationId`. A malformed id (fails `UUID_PATTERN`) returns `GENERIC_ERROR`.
- `delete().eq("id", medicationId)`. A database error is logged with `console.error` and returns `GENERIC_ERROR`.
- Otherwise it calls `revalidatePath("/", "layout")` and returns `{ status: "success" }`.

#### 3. Confirmation dialog

**File**: `src/components/medications/remove-medication-dialog.tsx` (new)

**Intent**: A "Remove <name>?" dialog modelled on `PauseMedicationDialog`. The medication's name and stock disappear for good; pausing stays the alternative.

**Contract**:
- Controlled `open`/`onOpenChange` props plus `medication` (id, name).
- Uses `useSaveGuard` and wraps the call in `runSaveAction`.
- Posts a hidden `medicationId`.
- Description: "This removes <name> and its stock from this profile. This can't be undone." It also points to Pause as the reversible alternative when the medication is not paused.
- On success: `toast.success(medicationRemovedMessage(name))`, then close.
- A server error shows in an inline `Alert`.
- Buttons: Cancel (`DialogClose`, outline) and a destructive "Remove" ("Removing…" while pending).
- The dialog content keeps the name it opened with while it closes. The card unmounts after the revalidation, which closes the dialog too, so the toast must fire before `onSaved`.

#### 4. Menu wiring

**File**: `src/components/medications/medication-options-menu.tsx`

**Intent**: Enable "Remove" and open the new dialog.

**Contract**:
- `OpenDialog` gains `"remove"`.
- The item loses `disabled`, keeps `variant="destructive"`, and calls `onSelect={() => setDialog("remove")}`.
- Render `<RemoveMedicationDialog … {...dialogProps("remove")} />`.
- Update the component doc comment (no longer a placeholder).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new message test
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- "Remove" on a card opens "Remove <name>?". Cancel, Escape and an outside click close it without changes
- Confirming removes the card, updates the tiles, counts and sidebar dot, and shows "<name> removed"
- Removing the same medication again from a second, stale tab shows success and the card disappears there after refresh
- With the network offline, confirming shows the connection-error toast and the dialog stays open

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Edit a profile

### Overview

Add the ⋯ on the active sidebar row with "Edit profile", and an edit page that reuses the profile form (FR-004, FR-022).

### Changes Required:

#### 1. Shared field validation

**File**: `src/lib/profiles/validation.ts`, `src/lib/profiles/validation.test.ts`

**Intent**: Move the name/kind/colour/avatar checks from `createProfile` into one pure helper, so create and edit validate identically.

**Contract**:
- `validateProfileFields({ name, kind, avatarColor, avatar }): Partial<Record<"name" | "kind" | "avatarColor" | "avatar", string>>`.
- Same messages as today (`actions.ts:61-70`). An empty `avatar` means "No avatar". Avatar is checked against kind only when kind is valid.
- Tests cover: a valid set; each invalid field; an avatar not allowed for the kind; an empty avatar.

#### 2. Server actions

**File**: `src/lib/profiles/actions.ts`

**Intent**: `createProfile` uses the helper with no behaviour change. A new `updateProfile` saves the edited fields.

**Contract**: `updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState>`.
- Calls `getCurrentUser()`.
- Reads `profileId`, `name`, `kind`, `avatarColor` and `avatar`, and validates them with the helper.
- `update({ name, kind, avatar_color, avatar: avatar || null }).eq("id", profileId).select("id")`.
- A database error is logged and returns `GENERIC_ERROR`. 0 rows (deleted or not the caller's) also returns `GENERIC_ERROR`.
- On success: `revalidatePath("/", "layout")` and `{ status: "success", profileId }`.

#### 3. Toast wording

**File**: `src/lib/feedback/messages.ts`, `messages.test.ts`

**Contract**: `profileUpdatedMessage(name)` returns `"Profile <name> updated"`, with a test.

#### 4. Profile form edit mode

**File**: `src/components/profiles/profile-form.tsx`

**Intent**: Let the form start from a stored profile and speak in edit terms. Create mode stays exactly as it is.

**Contract**:
- Optional `initial?: { profileId: string; name: string; kind: ProfileKind; avatarColor: AvatarColor; avatar: ProfileAvatar | null }`.
- When present, it:
  - seeds the state;
  - posts a hidden `profileId`;
  - shows the toast from `profileUpdatedMessage`;
  - uses a non-Plus icon (e.g. `Check`) and the pending label "Saving…";
  - leaves the submit label to the caller (e.g. "Save changes", without the typed-name suffix).
- Changing the kind still clears the avatar (`profile-form.tsx:169-174`).
- Success navigates to `/?profile=<id>`. `useSavedFormReset` behaviour is unchanged.

#### 5. Edit page

**File**: `src/app/(app)/profiles/[id]/edit/page.tsx` (new)

**Intent**: A page laid out like "Add a profile" (`src/app/(app)/profiles/new/page.tsx`) that loads the profile and renders the form in edit mode.

**Contract**:
- Static heading "Edit profile", with metadata title `Edit profile · Out of Pills`.
- Inside `<Suspense fallback={<PageLoader />}>`, read `params`, `getCaregiver()` (`null` redirects to `/onboarding/name`) and `listProfiles()`.
- A profile not in the list (unknown, foreign or deleted) redirects to `/`.
- Render `ProfileForm` with `initial`, `action={updateProfile}`, `backHref="/?profile=<id>"`, `backLabel="Cancel"` and `submitLabel="Save changes"`.

#### 6. Sidebar ⋯ with "Edit profile"

**File**: `src/components/app-shell/profile-nav.tsx` (and a new `src/components/app-shell/profile-options-menu.tsx` client component)

**Intent**: Match mock 176:226: a ⋯ on the selected row opens a dropdown, which in this phase holds "Edit profile".

**Contract**:
- A `SidebarMenuAction` (`sidebar.tsx:543`) rendered only for the selected row, with `aria-label="Options for <name>"` and an `Ellipsis` icon. It is positioned and sized to sit vertically centred in the `size="row"` button, with the row's name truncated before it.
- It opens a `DropdownMenu` with "Edit profile" (`Pencil` icon), which navigates via `navigate("/profiles/<id>/edit")` and closes the mobile sheet.
- Selection: on `/profiles/<id>/edit` the row with that id is selected (active style, ⋯ shown), alongside the existing `/` rule.
- The icon rail hides the ⋯ (built into `SidebarMenuAction`).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `validateProfileFields` and `profileUpdatedMessage` tests
- `npm run lint` and `npm run build` pass

#### Manual Verification:

- The active sidebar row shows ⋯ (desktop and mobile sheet). Inactive rows and the collapsed rail don't
- "Edit profile" opens the edit page, pre-filled with name, type, colour and avatar
- Renaming, changing colour and choosing or removing an avatar saves, shows "Profile <name> updated", and returns to the profile with the sidebar and header updated
- Changing the type clears an avatar that doesn't fit. Saving with an empty name shows the inline error
- `/profiles/<random-uuid>/edit` redirects to `/`. Creating a profile still behaves as before

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: Delete a profile

### Overview

Add "Delete profile" to the sidebar ⋯ with an impact-stating confirmation (FR-005), then release.

### Changes Required:

#### 1. Toast wording

**File**: `src/lib/feedback/messages.ts`, `messages.test.ts`

**Contract**: `profileDeletedMessage(name)` returns `"Profile <name> deleted"`, with a test.

#### 2. Server action

**File**: `src/lib/profiles/actions.ts`

**Intent**: Detach the caller from the profile through `delete_profile`. Doing so deletes the profile and its medications when no caregiver is left.

**Contract**: `deleteProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState>`.
- Calls `getCurrentUser()`.
- Reads `profileId`. A malformed UUID returns `GENERIC_ERROR`.
- `rpc("delete_profile", { p_profile_id })`. A `42501` error redirects to `/sign-in`. Any other error is logged and returns `GENERIC_ERROR`.
- On success: `revalidatePath("/", "layout")` and `{ status: "success" }`. A profile that was already gone is a success too.

#### 3. Medication counts for the sidebar

**File**: `src/components/app-shell/app-sidebar.tsx`, `profile-nav.tsx`

**Intent**: Give the dialog the number of medications that go with the profile, without lying when the medications failed to load.

**Contract**:
- `loadMedicationsForDots` returns `null` on failure. The dots treat `null` as none.
- `ProfileNavItem` gains `medicationCount: number | null`: the number of the profile's medications, or `null` when they failed to load.

#### 4. Confirmation dialog and menu item

**File**: `src/components/app-shell/delete-profile-dialog.tsx` (new), `profile-options-menu.tsx`

**Intent**: A "Delete <name>?" dialog stating the consequence, opened from a destructive "Delete profile" item under "Edit profile".

**Contract**:
- The description says, for example, "This deletes the profile and its 3 medications. This can't be undone."
- Wording for the other counts:
  - singular "1 medication";
  - "This deletes the profile. This can't be undone." for 0;
  - "…and all its medications…" for `null`.
- Uses `useSaveGuard` and `runSaveAction`, and posts a hidden `profileId`.
- Buttons: Cancel and a destructive "Delete profile" ("Deleting…" while pending). Errors show in an inline `Alert`.
- On success: toast `profileDeletedMessage(name)`, close the dialog and the mobile sheet, then `navigate("/")`. The page shows the oldest remaining profile, or the existing redirect opens `/onboarding/profile` when none remain.
- The menu keeps its open-dialog state the same way `MedicationOptionsMenu` does (`medication-options-menu.tsx:25-34`). The dialog renders outside the row so it survives the row unmounting after revalidation.

#### 5. Release

**Intent**: Follow the migration release order from AGENTS.md.

**Contract**:
- `npx supabase db push --remote --dry-run`, then `npx supabase db push --remote`, before merge.
- Open a PR from `profiles/rename-and-delete` against `master` that references FR-004, FR-005, FR-013 and FR-022.
- Check the Vercel preview.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `profileDeletedMessage` tests
- `npm run lint` and `npm run build` pass
- `npx supabase test db` still passes
- `npx supabase db push --remote --dry-run` lists only the new migration

#### Manual Verification:

- "Delete profile" opens "Delete <name>?" with the correct medication count (0 / 1 / many). Cancel leaves everything as it was
- Confirming deletes the profile and its medications, shows "Profile <name> deleted", and lands on the oldest remaining profile
- Deleting from the edit page also lands on `/`
- Deleting the only profile lands on the onboarding "first profile" step. Creating one there returns to the app
- On the Vercel preview (after the remote push): edit, delete profile and remove medication all work against the cloud database

**Implementation Note**: After automated verification passes, pause for manual confirmation before merging.

---

## Testing Strategy

### Unit Tests:

- `validateProfileFields`: valid input, each invalid field, an avatar outside the kind's list, an empty avatar.
- `messages.test.ts`: `medicationRemovedMessage`, `profileUpdatedMessage`, `profileDeletedMessage`.

### Integration Tests:

- pgTAP (`rename_and_delete.test.sql` plus the rewritten assertions): owner update and delete paths, cross-user no-ops, update constraints, `delete_profile` with one and two caregivers, an unknown id, and anon access.

### Manual Testing Steps:

1. Edit a profile's name, type, colour and avatar. Check the sidebar, the header and the page title.
2. Remove a medication, both normally and from a stale tab.
3. Delete a profile that has medications, then delete the last remaining profile.
4. Repeat 1–3 on a phone-width viewport (sidebar sheet).

## Performance Considerations

None beyond today: the sidebar already loads all medications once per request, and counting them per profile reuses that list.

## Migration Notes

Additive migration. Existing rows are untouched. Push it to the cloud project before merging, and never edit it after the push.

## References

- Research: `context/changes/rename-and-delete/research.md`
- Mock: Figma `Out-of-pills`, node 176:226 (⋯ on the active sidebar row)
- Pattern: `supabase/migrations/20261116165228_profiles.sql:97-128` (`create_profile`)
- Pattern: `src/components/medications/pause-medication-dialog.tsx` (confirmation dialog)
- Pattern: `src/app/(app)/profiles/new/page.tsx` (profile form page)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database privileges and `delete_profile`

#### Automated

- [x] 1.1 `npx supabase db reset` applies all migrations cleanly — d92b233
- [x] 1.2 `npx supabase test db` passes, including `rename_and_delete.test.sql` and the rewritten assertions — d92b233
- [x] 1.3 `npm run db:types` regenerates `database.types.ts` with `delete_profile` and the file starts with `export type` — d92b233
- [x] 1.4 `npm run lint`, `npm test` and `npm run build` pass — d92b233

#### Manual

- [x] 1.5 In local Studio, the new policies and `delete_profile` are visible, with RLS still enabled on every table — d92b233

### Phase 2: Remove a medication

#### Automated

- [x] 2.1 `npm test` passes, including the new message test
- [x] 2.2 `npm run lint` and `npm run build` pass

#### Manual

- [x] 2.3 "Remove" opens "Remove <name>?"; Cancel, Escape and outside click close it without changes
- [x] 2.4 Confirming removes the card, updates tiles, counts and the sidebar dot, and shows "<name> removed"
- [x] 2.5 Removing again from a stale tab shows success and the card disappears there
- [x] 2.6 Offline confirm shows the connection-error toast and the dialog stays open

### Phase 3: Edit a profile

#### Automated

- [ ] 3.1 `npm test` passes, including `validateProfileFields` and `profileUpdatedMessage` tests
- [ ] 3.2 `npm run lint` and `npm run build` pass

#### Manual

- [ ] 3.3 Active sidebar row shows ⋯ (desktop and mobile sheet); inactive rows and the collapsed rail don't
- [ ] 3.4 "Edit profile" opens the edit page pre-filled with name, type, colour and avatar
- [ ] 3.5 Rename, colour and avatar changes save, toast "Profile <name> updated", and return to the profile with the sidebar and header updated
- [ ] 3.6 Changing type clears a mismatched avatar; an empty name shows the inline error
- [ ] 3.7 `/profiles/<random-uuid>/edit` redirects to `/`; creating a profile still behaves as before

### Phase 4: Delete a profile

#### Automated

- [ ] 4.1 `npm test` passes, including `profileDeletedMessage` tests
- [ ] 4.2 `npm run lint` and `npm run build` pass
- [ ] 4.3 `npx supabase test db` still passes
- [ ] 4.4 `npx supabase db push --remote --dry-run` lists only the new migration

#### Manual

- [ ] 4.5 "Delete profile" opens "Delete <name>?" with the correct medication count (0 / 1 / many); Cancel changes nothing
- [ ] 4.6 Confirming deletes the profile and its medications, toasts "Profile <name> deleted", and lands on the oldest remaining profile
- [ ] 4.7 Deleting from the edit page also lands on `/`
- [ ] 4.8 Deleting the only profile lands on onboarding "first profile"; creating one returns to the app
- [ ] 4.9 On the Vercel preview after the remote push, edit, delete profile and remove medication work against the cloud database
