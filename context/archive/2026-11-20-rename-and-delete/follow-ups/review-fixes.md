# Review follow-ups: rename-and-delete

Source: `context/changes/rename-and-delete/reviews/impl-review.md` (2026-11-20).

These are deferred to the profile-sharing slice (FR-016). Neither can happen while a profile has exactly one caregiver, which is how v1 works: `create_profile` links only the caller.

## F1 — Lock the profile in `delete_profile` before detaching

- **Where**: `supabase/migrations/20261120133259_rename_and_delete.sql:84-97`. The migration is already pushed, so the fix needs a new additive migration (`create or replace function`).
- **Problem**: Suppose two caregivers of one profile call `delete_profile` at the same time. Under READ COMMITTED, each `not exists (… profile_caregivers …)` still sees the other's uncommitted membership row, so neither deletes the profile. It is left with no caregiver, and it and its medications become unreachable.
- **Fix**: As the function's first step after the `auth.uid()` check, lock the row with `perform 1 from public.profiles where id = p_profile_id for update;`. Concurrent detaches then run one after the other, and the second one sees the first's committed delete.

## F2 — Delete dialog wording for shared profiles

- **Where**: `src/components/app-shell/delete-profile-dialog.tsx:28-33` (`deletionImpact`).
- **Problem**: The dialog says "This deletes the profile and its N medications. This can't be undone." When other caregivers remain, `delete_profile` only detaches the caller, so that copy would be wrong.
- **Fix**: Pass the caregiver count, or a "shared" flag, to the dialog. When others remain, say the caller is leaving the profile ("Leave <name>?"), and keep the delete wording for the last caregiver.
