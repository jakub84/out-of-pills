# Profile Avatars Implementation Plan

## Overview

Let a caregiver optionally choose a ready-made portrait avatar when creating a profile (FR-021, roadmap S-11). The choices depend on the profile type. The avatar appears on the profile list and on the main screen; a profile without one keeps showing the first letter of its name.

## Current State Analysis

- A profile stores `name`, `kind` and a required `avatar_color`; there is no avatar field (`supabase/migrations/20261116165228_profiles.sql:38-45`).
- Profiles are inserted only through `create_profile(p_name, p_kind, p_avatar_color)`; direct inserts are denied (`supabase/migrations/20261116165228_profiles.sql:97-128`).
- One `ProfileForm` serves onboarding and `/profiles/new`, and posts `name`, `kind`, `avatarColor` as hidden or named fields (`src/components/profiles/profile-form.tsx:63-92`).
- `createProfile` validates and calls the RPC (`src/lib/profiles/actions.ts:47-85`). `listProfiles` maps rows to `Profile` (`src/lib/profiles/dal.ts:47-66`).
- The profile circle is rendered only in the sidebar, at 24 px with the initial (`src/components/app-shell/profile-nav.tsx:56-64`). The main screen shows the name in text only (`src/app/(app)/page.tsx:84-90`).
- There is no way to edit a profile yet; that arrives with S-08.

## Desired End State

The profile form has an always-visible avatar grid with "No avatar" selected by default. The options follow the selected profile type. A chosen avatar is saved and shown at 32 px on the profile list and larger beside the profile name on the main screen, framed by the profile colour. Profiles without an avatar, including all existing ones, show the letter in the same places.

### Key Discoveries:

- Migrations reach production before the code, and production currently runs older code, so `create_profile(text, text, text)` must keep working.
- Keeping the three-argument function and adding a four-argument overload without defaults avoids an ambiguous call for existing three-argument callers, including the pgTAP tests (`supabase/tests/database/profiles_rls.test.sql:22`).
- `src/proxy.ts:12` already excludes `.webp` files from auth handling, so files in `public/avatars/` load on every screen.
- `next/image` is already used for local brand images (`src/app/(app)/page.tsx:38-44`).
- `avatarBgClass` (`src/components/profiles/avatar-colors.ts:4-11`) can provide the colour frame: a coloured circle with padding around the image.
- The collapsed sidebar is 72 px wide and rows are 48 px high (`src/components/ui/sidebar.tsx:31,483`), so a 32 px circle fits in both states.

## What We're NOT Doing

- Photo upload or Supabase Storage.
- Changing or removing an avatar after creation, or adding one to an existing profile (FR-022, delivered by S-08).
- Changing a profile's type after creation.
- Demo-mode avatars (S-10 reuses this catalogue later).
- Lucide icon avatars.

## Implementation Approach

Data first, UI last, as in earlier slices. The catalogue lives in pure code and is mirrored by a database constraint. The UI shares one `ProfileAvatar` component. With no avatar, the action keeps using the existing RPC signature; with one, it uses the new overload.

## Critical Implementation Details

**Two RPC signatures.** Do not add a `default` to the new `p_avatar` argument and do not replace the existing function. The action calls the three-argument version when no avatar is selected and the four-argument version otherwise, which also avoids passing `null` to a generated `string` argument type.

**Migration timing.** After this change `listProfiles` selects `avatar`, so the migration must be in the cloud database before the PR preview runs.

## Phase 1: Avatar Catalogue and Database

### Overview

Define which avatars belong to which profile type, and enforce the same rule in the database.

### Changes Required:

#### 1. Avatar catalogue

**File**: `src/lib/profiles/validation.ts`, `src/lib/profiles/validation.test.ts`

**Intent**: Add the allowed avatars and the per-type sets, test-first, in the module that already mirrors the profile migration checks.

**Contract**: Exports `PROFILE_AVATARS`, type `ProfileAvatar`, `AVATARS_BY_KIND`, `isProfileAvatar(value)` and `isAvatarForKind(kind, value)`.

| Kind | Avatars, in display order |
| --- | --- |
| `me` | `woman`, `man` |
| `parent` | `mom`, `dad`, `grandma`, `grandpa` |
| `child` | `son`, `daughter` |
| `other` | `woman`, `man`, `grandma`, `grandpa`, `cat`, `dog` |

Tests cover every kind, an avatar from another kind, an unknown value and the empty string.

#### 2. Migration

**File**: `supabase/migrations/<timestamp>_profile_avatars.sql`

**Intent**: Store the optional avatar and allow it to be set at creation without affecting existing callers. Additive only; RLS on `profiles` is unchanged.

**Contract**: `profiles.avatar text null`, plus a check constraint that allows `null` or an avatar from the table above for the row's `kind`. New `create_profile(p_name text, p_kind text, p_avatar_color text, p_avatar text)`, `security definer`, `search_path = ''`, with the same authentication and caregiver checks and error codes as the existing function. Execute revoked from `public, anon`, granted to `authenticated`.

#### 3. Database tests and types

**File**: `supabase/tests/database/profile_avatars.test.sql`, `src/lib/supabase/database.types.ts`

**Intent**: Prove the rule and the privacy boundary, then regenerate types with `npm run db:types`.

**Contract**: Tests cover: the three-argument call still creates a profile with a `null` avatar; a matching avatar is stored; a mismatched or unknown avatar is rejected; the new function links only the caller; it fails for a caller without a caregiver row; anon cannot execute it; another caregiver cannot read the avatar.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Migration applies on a clean database: `npx supabase db reset`
- Database tests pass: `npx supabase test db`
- Generated types are current: `npm run db:types` leaves `git status` clean
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- In Studio (http://127.0.0.1:55323) `profiles.avatar` is empty for profiles created through the three-argument function

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Avatar Images and Display

### Overview

Add the images and show avatars on the profile list and main screen.

### Changes Required:

#### 1. Image assets

**File**: `public/avatars/{mom,dad,grandma,grandpa,woman,man,son,daughter,cat,dog}.webp`

**Intent**: Add web-sized copies of the supplied portraits. The conversion is a one-off; no script or new dependency is committed.

**Contract**: Source: `C:\Users\jakub\OneDrive\Dokumenty\ProductLab AI - kurs\avatars 2.0`. Output: 256×256 WebP. `douther.webp` becomes `daughter.webp`. `man.webp` is first cropped to `left 192, top 0, width 640, height 640` so the "COMMANDO" tag and bottom lettering are not visible.

#### 2. Shared avatar component

**File**: `src/components/profiles/profile-avatar.tsx`, `src/components/profiles/avatar-colors.ts`

**Intent**: Render either the image inside a colour frame or the letter on the colour, so every surface behaves the same. Add readable avatar names for the picker.

**Contract**: `ProfileAvatar` takes the initial, `avatarColor`, nullable `avatar` and a size for 32 px (list) or 64 px (picker and main screen, 80 px from `sm` on the main screen). No `"use client"`. The image uses `next/image` with empty `alt`, because the profile name or radio label is adjacent. `avatarLabel` maps each avatar to an English name such as "Mom".

#### 3. Read and display

**File**: `src/lib/profiles/dal.ts`, `src/components/app-shell/app-sidebar.tsx`, `src/components/app-shell/profile-nav.tsx`, `src/app/(app)/page.tsx`

**Intent**: Load the avatar and show it on the list and beside the selected profile's name.

**Contract**: `Profile.avatar: ProfileAvatar | null`, narrowed with `isProfileAvatar`. `ProfileNavItem` gains `avatar`. List avatars, their skeleton and the "Add new" marker become 32 px so labels stay aligned. On the main screen the avatar sits beside the `h1`, and long names still wrap.

### Success Criteria:

#### Automated Verification:

- `public/avatars/` holds exactly 10 WebP files, each 256×256 and under 60 KB
- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- A profile given an avatar in Studio shows it at 32 px on the list and larger on the main screen, framed by its colour
- A profile without an avatar shows its letter on its colour in both places
- The collapsed sidebar, a 375 px screen and a 40-character profile name all display correctly
- The `man` avatar shows no lettering

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Avatar Picker and Release

### Overview

Let users choose an avatar, then document and release the slice.

### Changes Required:

#### 1. Profile form

**File**: `src/components/profiles/profile-form.tsx`

**Intent**: Add an always-visible, optional avatar grid below the name and colour row, following the existing radio pattern. Changing the profile type returns the choice to "No avatar", so a hidden selection from another type can never be submitted.

**Contract**: Heading "Avatar (optional)". The first option is "No avatar" and shows the letter; the others come from `AVATARS_BY_KIND[kind]`. Tiles use `ProfileAvatar` with the selected colour. Hidden field `avatar` is empty for no avatar. Each radio has an accessible name, and the grid works at 375 px and by keyboard.

#### 2. Server action

**File**: `src/lib/profiles/actions.ts`, `src/lib/profiles/form-state.ts`

**Intent**: Reject an avatar that does not belong to the submitted type, then create the profile through the matching RPC signature.

**Contract**: `fieldErrors.avatar` with "Choose an avatar from the list", shown under the grid. Empty value → existing three-argument RPC; otherwise → four-argument RPC with `p_avatar`. Existing error mapping is unchanged.

#### 3. Docs and release

**File**: `AGENTS.md`

**Intent**: Record the new asset folder and component, then release in the required order.

**Contract**: Update the structure notes for `src/components/profiles/` and `public/avatars/`. After local gates: `npx supabase db push --remote --dry-run`, then with user approval `npx supabase db push --remote`. Create the S-11 GitHub issue, record its number in the roadmap's Backlog Handoff, push the branch and open a PR against `master` referencing FR-021 and closing that issue.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Database tests pass: `npx supabase test db`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- On the PR, `Lint and build` and `preview` succeed: `gh pr checks`

#### Manual Verification:

- Each profile type shows exactly its avatars, after "No avatar"
- Creating a profile without choosing an avatar stores none and shows the letter
- Creating a profile with an avatar shows it on the list and the main screen
- Changing the profile type after choosing an avatar returns to "No avatar"
- A tampered avatar value shows the field error and nothing is saved
- The picker works at 375 px and with keyboard only
- The picker works in onboarding and on `/profiles/new`
- Before the PR opened, `npx supabase db push --remote` applied the migration
- On the PR preview, a real account can create a profile with an avatar

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Avatar sets for every profile type, including rejection of avatars from other types, unknown values and the empty string.

### Integration Tests:

- pgTAP covers both RPC signatures, the kind and avatar constraint, caller-only linking and anon denial.

### Manual Testing Steps:

1. Create one profile of each type, with and without an avatar.
2. Choose an avatar, change the type and confirm the selection resets.
3. Check the list, collapsed sidebar and main screen at desktop width and 375 px.

## Performance Considerations

Source images are reduced from 226–533 KB to small 256 px files, and `next/image` serves sizes suited to each surface.

## Migration Notes

Additive: one nullable column, one constraint and one function overload. Existing profiles keep a `null` avatar. Rollback is a follow-up migration that drops them; a pushed migration is never edited.

## References

- Profile schema pattern: `supabase/migrations/20261116165228_profiles.sql`
- Form pattern: `src/components/profiles/profile-form.tsx:196-238`
- Database test pattern: `supabase/tests/database/profiles_rls.test.sql`
- Requirements: `context/foundation/prd.md` (FR-021, FR-022), `context/foundation/roadmap.md` (S-11, S-08)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Avatar Catalogue and Database

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 2f6b0ed
- [x] 1.2 Migration applies on a clean database: `npx supabase db reset` — 2f6b0ed
- [x] 1.3 Database tests pass: `npx supabase test db` — 2f6b0ed
- [x] 1.4 Generated types are current: `npm run db:types` leaves `git status` clean — 2f6b0ed
- [x] 1.5 Lint passes: `npm run lint` — 2f6b0ed
- [x] 1.6 Production build passes: `npm run build` — 2f6b0ed

#### Manual

- [x] 1.7 In Studio (http://127.0.0.1:55323) `profiles.avatar` is empty for profiles created through the three-argument function — 2f6b0ed

### Phase 2: Avatar Images and Display

#### Automated

- [x] 2.1 `public/avatars/` holds exactly 10 WebP files, each 256×256 and under 60 KB
- [x] 2.2 Unit tests pass: `npm test`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Production build passes: `npm run build`

#### Manual

- [x] 2.5 A profile given an avatar in Studio shows it at 32 px on the list and larger on the main screen, framed by its colour
- [x] 2.6 A profile without an avatar shows its letter on its colour in both places
- [x] 2.7 The collapsed sidebar, a 375 px screen and a 40-character profile name all display correctly
- [x] 2.8 The `man` avatar shows no lettering

### Phase 3: Avatar Picker and Release

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Database tests pass: `npx supabase test db`
- [ ] 3.3 Lint passes: `npm run lint`
- [ ] 3.4 Production build passes: `npm run build`
- [ ] 3.5 On the PR, `Lint and build` and `preview` succeed: `gh pr checks`

#### Manual

- [ ] 3.6 Each profile type shows exactly its avatars, after "No avatar"
- [ ] 3.7 Creating a profile without choosing an avatar stores none and shows the letter
- [ ] 3.8 Creating a profile with an avatar shows it on the list and the main screen
- [ ] 3.9 Changing the profile type after choosing an avatar returns to "No avatar"
- [ ] 3.10 A tampered avatar value shows the field error and nothing is saved
- [ ] 3.11 The picker works at 375 px and with keyboard only
- [ ] 3.12 The picker works in onboarding and on `/profiles/new`
- [ ] 3.13 Before the PR opened, `npx supabase db push --remote` applied the migration
- [ ] 3.14 On the PR preview, a real account can create a profile with an avatar
