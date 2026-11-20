-- Privacy guardrail for medications: data stays with the profile's caregiver.
-- Run with: npx supabase test db
begin;

select plan(23);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): user A and B, each with a name and one profile.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'authenticated', 'authenticated');

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
-- A caregiver adds and reads their own profile's medications.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select lives_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Aspirin', 30, 12.5, 1.5)$$,
  'A can add a medication to their own profile'
);
select results_eq(
  $$select profile_id, name, package_size, pills_counted, daily_dose from public.medications$$,
  $$select current_setting('test.profile_a')::uuid, 'Aspirin'::text, 30, 12.5::numeric, 1.5::numeric$$,
  'A reads their own profile''s medication'
);
select is(
  (select counted_on from public.medications where name = 'Aspirin'),
  (now() at time zone 'Europe/Warsaw')::date,
  'counted_on defaults to today''s date in Europe/Warsaw'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose, counted_on)
    values (current_setting('test.profile_a')::uuid, 'Backdated', 30, 10, 1, '2020-01-01')$$,
  '42501',
  null,
  'Setting counted_on on insert is denied'
);

-- ---------------------------------------------------------------------------
-- B cannot reach A's medications.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select lives_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_b')::uuid, 'Vitamin D', 60, 40, 1)$$,
  'B can add a medication to their own profile'
);
select results_eq(
  $$select name from public.medications$$,
  $$values ('Vitamin D'::text)$$,
  'B sees only their own profile''s medications'
);
select is_empty(
  $$select 1 from public.medications where profile_id = current_setting('test.profile_a')::uuid$$,
  'B cannot select A''s medications by profile id'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Planted', 30, 10, 1)$$,
  '42501',
  null,
  'B cannot add a medication to A''s profile'
);
-- name is updatable since S-07, so RLS hides A's rows: the update matches nothing
-- (the ground truth below proves A's medication is unchanged).
select lives_ok(
  $$update public.medications set name = 'Hacked'
    where profile_id = current_setting('test.profile_a')::uuid$$,
  'B''s update of A''s medications runs without error (matches no rows)'
);
-- delete is granted since S-08, so RLS hides A's rows: the delete matches
-- nothing (the ground truth below proves A's medication still exists).
select lives_ok(
  $$delete from public.medications where profile_id = current_setting('test.profile_a')::uuid$$,
  'B''s delete of A''s medications runs without error (matches no rows)'
);

-- ---------------------------------------------------------------------------
-- anon has no access at all.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok('select * from public.medications', '42501', null, 'anon cannot read medications');
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Anon', 30, 10, 1)$$,
  '42501',
  null,
  'anon cannot add medications'
);

-- ---------------------------------------------------------------------------
-- Ground truth as postgres: nothing leaked or changed.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select name from public.medications where profile_id = current_setting('test.profile_a')::uuid$$,
  $$values ('Aspirin'::text)$$,
  'A''s profile holds only A''s unchanged medication'
);

-- ---------------------------------------------------------------------------
-- Check constraints.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, '   ', 30, 10, 1)$$,
  '23514', null, 'An empty (blank) medication name is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, repeat('x', 81), 30, 10, 1)$$,
  '23514', null, 'An 81-character medication name is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 0, 10, 1)$$,
  '23514', null, 'A package size of 0 is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 1001, 10, 1)$$,
  '23514', null, 'A package size of 1001 is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 30, -0.5, 1)$$,
  '23514', null, 'A negative pill count is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 30, 0.3, 1)$$,
  '23514', null, 'A pill count that is not a multiple of 0.5 is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 30, 10, 0)$$,
  '23514', null, 'A daily dose of 0 is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 30, 10, 0.3)$$,
  '23514', null, 'A daily dose that is not a multiple of 0.5 is rejected'
);
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
    values (current_setting('test.profile_a')::uuid, 'Pill', 30, 10, 50.5)$$,
  '23514', null, 'A daily dose of 50.5 is rejected'
);

-- ---------------------------------------------------------------------------
-- Deleting a profile removes its medications.
-- ---------------------------------------------------------------------------
delete from public.profiles where id = current_setting('test.profile_a')::uuid;

select is_empty(
  $$select 1 from public.medications where profile_id = current_setting('test.profile_a')::uuid$$,
  'Deleting a profile cascades to its medications'
);

select * from finish();
rollback;
