-- Rename and delete (S-08): a caregiver edits their own profiles (FR-004, FR-022),
-- deletes a profile (FR-005) and deletes a medication (FR-013).
-- Additive only: earlier migrations stay as pushed. Every new policy uses the
-- same profile membership as the existing select policies, scoped to auth.uid().
--
-- Deleting a profile is "the last caregiver detaches": delete_profile() removes
-- the caller's own membership and deletes the profile (and, by cascade, its
-- medications) only when no other caregiver still belongs to it.
--
-- profile_caregivers gets no new policy: its policies only compare user_id and
-- never query profiles (avoids policy recursion); delete_profile() is the only
-- way to remove a membership.

-- ---------------------------------------------------------------------------
-- profiles: update policy, same membership as select. The existing checks
-- (name, kind, colour, avatar per kind) apply to updates unchanged.
-- ---------------------------------------------------------------------------
create policy "Caregivers can update profiles they belong to"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = profiles.id
        and pc.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = profiles.id
        and pc.user_id = (select auth.uid())
    )
  );

-- Only the user-entered columns are writable; id and created_at stay fixed.
grant update (name, kind, avatar_color, avatar) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- medications: delete policy, same membership as select.
-- ---------------------------------------------------------------------------
create policy "Caregivers can delete medications of their profiles"
  on public.medications for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = medications.profile_id
        and pc.user_id = (select auth.uid())
    )
  );

grant delete on table public.medications to authenticated;

-- ---------------------------------------------------------------------------
-- delete_profile(): the caller detaches from a profile; the last caregiver to
-- detach deletes it, and its medications go with it (on delete cascade).
-- An unknown id, or a profile the caller does not belong to, deletes nothing
-- and does not raise, so "already gone" stays a success and another
-- caregiver's profile is never touched.
-- security definer so it can delete past RLS; it only ever removes the
-- membership of auth.uid().
-- ---------------------------------------------------------------------------
create function public.delete_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  delete from public.profile_caregivers pc
  where pc.profile_id = p_profile_id
    and pc.user_id = v_user_id;

  -- Only a membership removed just now can leave the profile without
  -- caregivers; without one, the profile is not the caller's to delete.
  if not found then
    return;
  end if;

  delete from public.profiles p
  where p.id = p_profile_id
    and not exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = p_profile_id
    );
end;
$$;

revoke execute on function public.delete_profile(uuid) from public, anon;
grant execute on function public.delete_profile(uuid) to authenticated;
