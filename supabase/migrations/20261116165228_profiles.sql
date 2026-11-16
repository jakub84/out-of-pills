-- Caregivers, profiles and profile memberships (FR-003, FR-006).
-- Every table enables RLS in this migration; policies are scoped to auth.uid().
-- RLS without recursion: profiles policies look at profile_caregivers, while
-- profile_caregivers policies only compare user_id and never query profiles.

-- ---------------------------------------------------------------------------
-- caregivers: one row per signed-in user, holds the display name.
-- ---------------------------------------------------------------------------
create table public.caregivers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.caregivers enable row level security;

create policy "Caregivers can read their own row"
  on public.caregivers for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Caregivers can create their own row"
  on public.caregivers for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Caregivers can update their own row"
  on public.caregivers for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profiles: a person whose medication is tracked. Ownership lives in
-- profile_caregivers so a profile can later be shared between caregivers.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('me', 'parent', 'child', 'other')),
  avatar_color text not null
    check (avatar_color in ('mint', 'slate', 'sand', 'rose', 'lavender', 'stone')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- profile_caregivers: membership of a caregiver in a profile.
-- ---------------------------------------------------------------------------
create table public.profile_caregivers (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

create index profile_caregivers_user_id_idx on public.profile_caregivers (user_id);

alter table public.profile_caregivers enable row level security;

-- Only compares user_id; must never query profiles (avoids policy recursion).
create policy "Caregivers can read their own memberships"
  on public.profile_caregivers for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Rename and delete policies arrive with S-08; inserts go through create_profile().
create policy "Caregivers can read profiles they belong to"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = profiles.id
        and pc.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants: authenticated gets only what the policies need; anon gets nothing.
-- ---------------------------------------------------------------------------
revoke all on table public.caregivers from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.profile_caregivers from anon, authenticated;

grant select, insert, update on table public.caregivers to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.profile_caregivers to authenticated;

-- ---------------------------------------------------------------------------
-- create_profile(): creates a profile and links it to the caller atomically.
-- security definer so it can insert past RLS; it only ever links auth.uid().
-- ---------------------------------------------------------------------------
create function public.create_profile(p_name text, p_kind text, p_avatar_color text)
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

  insert into public.profiles (name, kind, avatar_color)
  values (p_name, p_kind, p_avatar_color)
  returning id into v_profile_id;

  insert into public.profile_caregivers (profile_id, user_id)
  values (v_profile_id, v_user_id);

  return v_profile_id;
end;
$$;

revoke execute on function public.create_profile(text, text, text) from public, anon;
grant execute on function public.create_profile(text, text, text) to authenticated;
