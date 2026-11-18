-- Optional illustrated avatar on a profile. Additive only: RLS and grants on
-- profiles are unchanged, so the avatar is readable exactly where the profile is.
-- The allowed avatars per kind are mirrored in src/lib/profiles/validation.ts.

alter table public.profiles
  add column avatar text,
  add constraint profiles_avatar_matches_kind check (
    avatar is null
    or (kind = 'me' and avatar in ('woman', 'man'))
    or (kind = 'parent' and avatar in ('mom', 'dad', 'grandma', 'grandpa'))
    or (kind = 'child' and avatar in ('son', 'daughter'))
    or (kind = 'other' and avatar in ('woman', 'man', 'grandma', 'grandpa', 'cat', 'dog'))
  );

-- ---------------------------------------------------------------------------
-- create_profile() with an avatar: same checks as the three-argument version,
-- which stays in place for code already deployed. p_avatar has no default, so
-- three-argument calls remain unambiguous.
-- security definer so it can insert past RLS; it only ever links auth.uid().
-- ---------------------------------------------------------------------------
create function public.create_profile(
  p_name text,
  p_kind text,
  p_avatar_color text,
  p_avatar text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- A profile never exists without its caregiver's display name.
  if not exists (select 1 from public.caregivers c where c.user_id = v_user_id) then
    raise exception 'Caregiver name is not set' using errcode = 'P0001';
  end if;

  insert into public.profiles (name, kind, avatar_color, avatar)
  values (p_name, p_kind, p_avatar_color, p_avatar)
  returning id into v_profile_id;

  insert into public.profile_caregivers (profile_id, user_id)
  values (v_profile_id, v_user_id);

  return v_profile_id;
end;
$$;

revoke execute on function public.create_profile(text, text, text, text) from public, anon;
grant execute on function public.create_profile(text, text, text, text) to authenticated;
