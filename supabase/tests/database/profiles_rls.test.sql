-- Privacy guardrail for caregivers, profiles and profile_caregivers (FR-003, FR-006).
-- Run with: npx supabase test db
begin;

select plan(26);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): user A and B with a name, user C without one.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com', 'authenticated', 'authenticated');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

insert into public.caregivers (user_id, display_name)
values ('00000000-0000-0000-0000-00000000000a', 'Anna');
select set_config('test.profile_a', public.create_profile('Mom', 'parent', 'mint')::text, true);

-- Act as user B.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

insert into public.caregivers (user_id, display_name)
values ('00000000-0000-0000-0000-00000000000b', 'Bob');
select set_config('test.profile_b', public.create_profile('Me', 'me', 'rose')::text, true);

-- ---------------------------------------------------------------------------
-- Each caregiver sees only their own rows.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select results_eq(
  'select user_id from public.caregivers',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'A sees only their own caregiver row'
);
select results_eq(
  'select id from public.profiles',
  $$select current_setting('test.profile_a')::uuid$$,
  'A sees only their own profiles'
);
select results_eq(
  'select profile_id, user_id from public.profile_caregivers',
  $$select current_setting('test.profile_a')::uuid, '00000000-0000-0000-0000-00000000000a'::uuid$$,
  'A sees only their own memberships'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select results_eq(
  'select user_id from public.caregivers',
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'B sees only their own caregiver row'
);
select results_eq(
  'select id from public.profiles',
  $$select current_setting('test.profile_b')::uuid$$,
  'B sees only their own profiles'
);
select results_eq(
  'select profile_id, user_id from public.profile_caregivers',
  $$select current_setting('test.profile_b')::uuid, '00000000-0000-0000-0000-00000000000b'::uuid$$,
  'B sees only their own memberships'
);

-- ---------------------------------------------------------------------------
-- B cannot reach A's data, even by id.
-- ---------------------------------------------------------------------------
select is_empty(
  $$select 1 from public.profiles where id = current_setting('test.profile_a')::uuid$$,
  'B cannot select A''s profile by id'
);
-- name is updatable since S-08, so RLS hides A's profile: the update matches
-- nothing (the ground truth below proves A's profile is unchanged).
select lives_ok(
  $$update public.profiles set name = 'Hacked' where id = current_setting('test.profile_a')::uuid$$,
  'B''s update of A''s profile runs without error (matches no rows)'
);
select throws_ok(
  $$insert into public.profile_caregivers (profile_id, user_id)
    values (current_setting('test.profile_a')::uuid, '00000000-0000-0000-0000-00000000000b')$$,
  '42501',
  null,
  'B cannot link themselves to A''s profile'
);
select is_empty(
  $$update public.caregivers set display_name = 'Hacked'
    where user_id = '00000000-0000-0000-0000-00000000000a' returning 1$$,
  'B cannot update A''s caregiver row'
);
select throws_ok(
  $$insert into public.caregivers (user_id, display_name)
    values ('00000000-0000-0000-0000-00000000000a', 'Hacked')$$,
  '42501',
  null,
  'B cannot create a caregiver row for A'
);
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color) values ('Direct', 'other', 'sand')$$,
  '42501',
  null,
  'Direct insert into profiles is denied'
);

-- create_profile() links only the caller.
select set_config('test.profile_b2', public.create_profile('Dad', 'parent', 'slate')::text, true);

-- ---------------------------------------------------------------------------
-- A caller without a caregivers row cannot create a profile.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text, true);

select throws_ok(
  $$select public.create_profile('Orphan', 'other', 'stone')$$,
  'P0001',
  'Caregiver name is not set',
  'create_profile() raises for a caller without a caregivers row'
);

-- ---------------------------------------------------------------------------
-- anon has no access at all.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok('select * from public.caregivers', '42501', null, 'anon cannot read caregivers');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.profile_caregivers', '42501', null, 'anon cannot read memberships');
select throws_ok(
  $$select public.create_profile('Anon', 'other', 'mint')$$,
  '42501',
  null,
  'anon cannot execute create_profile()'
);

-- ---------------------------------------------------------------------------
-- Ground truth as postgres: nothing leaked or changed.
-- ---------------------------------------------------------------------------
reset role;

select is(
  (select name from public.profiles where id = current_setting('test.profile_a')::uuid),
  'Mom',
  'A''s profile is unchanged'
);
select is(
  (select display_name from public.caregivers where user_id = '00000000-0000-0000-0000-00000000000a'),
  'Anna',
  'A''s caregiver row is unchanged'
);
select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_a')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'A''s profile is linked only to A'
);
select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_b2')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'create_profile() linked the new profile only to its caller'
);
select is_empty(
  $$select 1 from public.profiles where name in ('Orphan', 'Anon', 'Direct')$$,
  'Rejected calls created no profiles'
);

-- ---------------------------------------------------------------------------
-- Check constraints.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color) values ('   ', 'other', 'mint')$$,
  '23514',
  null,
  'An empty (blank) profile name is rejected'
);
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color) values (repeat('x', 41), 'other', 'mint')$$,
  '23514',
  null,
  'A 41-character profile name is rejected'
);
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color) values ('Mom', 'grandparent', 'mint')$$,
  '23514',
  null,
  'An unknown kind is rejected'
);
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color) values ('Mom', 'parent', 'blue')$$,
  '23514',
  null,
  'An unknown avatar colour is rejected'
);

select * from finish();
rollback;
