# Rename and Delete Profiles and Medications — Plan Brief

> Full plan: `context/changes/rename-and-delete/plan.md`
> Research: `context/changes/rename-and-delete/research.md`

## What & Why

Roadmap S-08 (FR-004, FR-005, FR-013, FR-022): caregivers need to fix a profile (a name typo, the wrong type, a new avatar) without deleting it, and to delete their own data: a single medication, or a whole profile with its medications. Every deletion goes through a confirmation. This also covers the PRD privacy rule "a user can delete their own data".

## Starting Point

Profiles are read-only in the database, and medications can't be deleted (S-08 was reserved in the migrations). The medication ⋯ menu already shows a disabled "Remove". The sidebar has no profile menu, and the profile form can only create.

## Desired End State

The active sidebar row has a ⋯ (mock 176:226) with "Edit profile" and "Delete profile":

- **Edit profile** opens a pre-filled edit page.
- **Delete profile** asks "Delete Mom?", says how many medications go with it, then lands on `/`, or on onboarding when no profiles are left.

The medication card's "Remove" asks "Remove Aspirin?" and removes it. Each action ends with a toast.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Profile controls | ⋯ on the active sidebar row → dropdown with Edit / Delete | Matches the Figma mock 176:226 | Plan (user) |
| Edit surface | `/profiles/<id>/edit` page reusing `ProfileForm` | The form is too tall for a phone dialog and already exists as a page | Plan |
| Editable fields | Name, type, colour, avatar; a type change clears a mismatched avatar | Fixes a wrong type without losing medications; same behaviour as create | Plan |
| Delete confirmation | Dialog naming the profile and its medication count | Clear consequence at one extra click; pause-dialog pattern | Plan |
| Last profile | Deletion allowed → existing redirect to onboarding | Honours "a user can delete their own data" with no new code path | Plan |
| Already-removed medication | Treated as success (toast, list refresh) | The user's goal is met; no confusing error | Plan |
| Profile deletion in the DB | `delete_profile` security-definer RPC: detach the caller, delete the profile when no caregiver is left | PRD "last caregiver detaches" rule; same pattern as `create_profile`; no new policy on `profile_caregivers` | Research → Plan |
| Edit/delete privileges | Column update grant on `profiles`; delete grant + policy on `medications`; both scoped by membership | Follows the per-slice column-grant pattern of S-06/S-07 | Research |

## Scope

**In scope:**
- One additive migration with pgTAP tests and regenerated types
- Medication remove dialog
- Profile edit page and form edit mode
- Sidebar ⋯ menu and the delete-profile dialog
- Three new toasts
- Remote migration push and PR

**Out of scope:**
- ⋯ on inactive rows, the header or the icon rail
- Type-to-confirm, undo or soft delete
- Sharing / leave UI (FR-016)
- Orphan clean-up for deleted auth users
- `stock.ts` changes
- Demo mode

## Architecture / Approach

Database first, then three UI slices:

- **Database:** `profiles` gets an update policy plus a grant on `(name, kind, avatar_color, avatar)`. `medications` gets a delete policy plus a grant. A new `delete_profile(uuid)` function removes the caller's membership, then deletes the profile only if no membership remains; cascades take its medications.
- **Server actions:** `removeMedication`, `updateProfile` and `deleteProfile` use the existing patterns: `getCurrentUser`, RLS scoping, `revalidatePath("/", "layout")`, a generic inline error, and `runSaveAction` with a toast on the client.
- **Validation:** create and update share one `validateProfileFields`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database privileges and `delete_profile` | Migration, pgTAP (new + 2 rewritten), types | Granting more than needed; must stay scoped by membership |
| 2. Remove a medication | Enabled "Remove" with a confirmation dialog and toast | Dialog closing as the card unmounts after revalidation |
| 3. Edit a profile | Sidebar ⋯ → Edit, `/profiles/<id>/edit`, `updateProfile` | Edit mode leaking into the create form's behaviour |
| 4. Delete a profile | Delete dialog with medication count, `deleteProfile`, release | Wrong "0 medications" when the sidebar's medication load fails; push before merge |

**Prerequisites:** S-02, S-03, S-11 done (they are). Local Supabase stack (Docker) running. Access to the cloud project for `db push --remote`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- The mock shows the ⋯ but not the dropdown contents. "Edit profile" and "Delete profile" come from the user's description, and the styling follows the existing medication menu.
- `delete_profile` is written for several caregivers, but v1 has one. Concurrent detaches by two caregivers are not locked (FR-016 is out of v1).

## Success Criteria (Summary)

- A caregiver can fix a profile's name, type, colour or avatar in place and see it everywhere at once.
- A caregiver can delete a medication, or a profile with all its medications, after one clear confirmation, and nothing of another user's is ever reachable.
