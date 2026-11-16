-- Medications tracked per profile: the inputs of the run-out calculation.
-- RLS is enabled in this migration; access follows profile membership, scoped
-- to auth.uid() through profile_caregivers (same template as profiles).

-- ---------------------------------------------------------------------------
-- medications: one row per medication of a profile.
-- Counts are stored in tablets with half-tablet precision.
-- ---------------------------------------------------------------------------
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  package_size integer not null check (package_size between 1 and 1000),
  pills_counted numeric(6, 1) not null
    check (
      pills_counted between 0 and 9999
      and pills_counted * 2 = trunc(pills_counted * 2)
    ),
  daily_dose numeric(4, 1) not null
    check (
      daily_dose > 0
      and daily_dose <= 50
      and daily_dose * 2 = trunc(daily_dose * 2)
    ),
  -- The calendar day of the count; set by the database, never by the client.
  counted_on date not null default ((now() at time zone 'Europe/Warsaw')::date),
  created_at timestamptz not null default now()
);

create index medications_profile_id_idx on public.medications (profile_id);

alter table public.medications enable row level security;

-- Update and delete policies arrive with the slices that edit and remove medications.
create policy "Caregivers can read medications of their profiles"
  on public.medications for select
  to authenticated
  using (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = medications.profile_id
        and pc.user_id = (select auth.uid())
    )
  );

create policy "Caregivers can add medications to their profiles"
  on public.medications for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = medications.profile_id
        and pc.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Grants: authenticated gets only what the policies need; anon gets nothing.
-- Insert is limited to the user-entered columns, so counted_on stays the
-- database's own date.
-- ---------------------------------------------------------------------------
revoke all on table public.medications from anon, authenticated;

grant select on table public.medications to authenticated;
grant insert (profile_id, name, package_size, pills_counted, daily_dose)
  on table public.medications to authenticated;
