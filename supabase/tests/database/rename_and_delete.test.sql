-- Rename and delete (S-08): a caregiver edits and deletes only their own
-- profiles and medications (FR-004, FR-005, FR-013, FR-022). delete_profile()
-- detaches the caller; the last caregiver to detach deletes the profile.
-- Run with: npx supabase test db
begin;

select plan(36);

-- ---------------------------------------------------------------------------
-- Fixtures: user A with two profiles, user B with one, and a profile shared by
-- A and B (inserted as postgres, since only delete_profile() and
-- create_profile() write memberships).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
insert into public.caregivers (user_id, display_name) values ('00000000-0000-0000-0000-00000000000a', 'Anna');
select set_config('test.profile_a', public.create_profile('Mom', 'parent', 'mint', 'mom')::text, true);
select set_config('test.profile_a2', public.create_profile('Old', 'other', 'sand')::text, true);
insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
values
  (current_setting('test.profile_a')::uuid, 'Aspirin', 30, 20, 1),
  (current_setting('test.profile_a')::uuid, 'Ibuprofen', 20, 10, 1),
  (current_setting('test.profile_a2')::uuid, 'Leftover', 30, 5, 1);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
insert into public.caregivers (user_id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'Bob');
select set_config('test.profile_b', public.create_profile('Me', 'me', 'rose')::text, true);
insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
values (current_setting('test.profile_b')::uuid, 'Vitamin D', 60, 40, 1);

reset role;
select set_config('test.profile_shared', '10000000-0000-0000-0000-000000000001', true);
insert into public.profiles (id, name, kind, avatar_color)
values (current_setting('test.profile_shared')::uuid, 'Grandpa', 'parent', 'stone');
insert into public.profile_caregivers (profile_id, user_id)
values
  (current_setting('test.profile_shared')::uuid, '00000000-0000-0000-0000-00000000000a'),
  (current_setting('test.profile_shared')::uuid, '00000000-0000-0000-0000-00000000000b');
insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
values (current_setting('test.profile_shared')::uuid, 'Shared pill', 30, 30, 1);
select set_config('test.med_aspirin', (select id::text from public.medications where name = 'Aspirin'), true);
select set_config('test.med_ibuprofen', (select id::text from public.medications where name = 'Ibuprofen'), true);

-- ---------------------------------------------------------------------------
-- A edits their own profile (FR-004).
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select lives_ok(
  $$update public.profiles
    set name = 'Mother', kind = 'other', avatar_color = 'rose', avatar = 'cat'
    where id = current_setting('test.profile_a')::uuid$$,
  'A can update name, kind, colour and avatar of their own profile'
);
select results_eq(
  $$select name, kind, avatar_color, avatar from public.profiles where id = current_setting('test.profile_a')::uuid$$,
  $$select 'Mother'::text, 'other'::text, 'rose'::text, 'cat'::text$$,
  'A''s profile changes are stored'
);

-- The existing checks apply to updates unchanged.
select throws_ok(
  $$update public.profiles set name = '   ' where id = current_setting('test.profile_a')::uuid$$,
  '23514', null, 'A blank profile name is rejected on update'
);
select throws_ok(
  $$update public.profiles set name = repeat('x', 41) where id = current_setting('test.profile_a')::uuid$$,
  '23514', null, 'A 41-character profile name is rejected on update'
);
select throws_ok(
  $$update public.profiles set avatar = 'mom' where id = current_setting('test.profile_a')::uuid$$,
  '23514', null, 'An avatar outside the profile kind''s set is rejected on update'
);
select throws_ok(
  $$update public.profiles set kind = 'child' where id = current_setting('test.profile_a')::uuid$$,
  '23514', null, 'A kind change that leaves the avatar unmatched is rejected on update'
);
select throws_ok(
  $$update public.profiles set avatar_color = 'blue' where id = current_setting('test.profile_a')::uuid$$,
  '23514', null, 'An unknown avatar colour is rejected on update'
);

-- id and created_at are not in the update grant.
select throws_ok(
  $$update public.profiles set id = gen_random_uuid() where id = current_setting('test.profile_a')::uuid$$,
  '42501', null, 'A cannot update profiles.id'
);
select throws_ok(
  $$update public.profiles set created_at = now() where id = current_setting('test.profile_a')::uuid$$,
  '42501', null, 'A cannot update profiles.created_at'
);

-- ---------------------------------------------------------------------------
-- A deletes their own medication (FR-013, FR-022).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$delete from public.medications where id = current_setting('test.med_ibuprofen')::uuid$$,
  'A can delete their own medication'
);
select is_empty(
  $$select 1 from public.medications where id = current_setting('test.med_ibuprofen')::uuid$$,
  'A''s deleted medication is gone'
);

-- ---------------------------------------------------------------------------
-- B cannot delete A's medication or A's profile.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select lives_ok(
  $$delete from public.medications where id = current_setting('test.med_aspirin')::uuid$$,
  'B''s delete of A''s medication runs without error (matches no rows)'
);
select lives_ok(
  $$select public.delete_profile(current_setting('test.profile_a')::uuid)$$,
  'B''s delete_profile() of A''s profile runs without error (deletes nothing)'
);

reset role;

select results_eq(
  $$select name from public.medications where profile_id = current_setting('test.profile_a')::uuid$$,
  $$values ('Aspirin'::text)$$,
  'A''s remaining medication survived B''s delete'
);
select is(
  (select name from public.profiles where id = current_setting('test.profile_a')::uuid),
  'Mother',
  'A''s profile survived B''s delete_profile()'
);
select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_a')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'A''s membership survived B''s delete_profile()'
);

-- ---------------------------------------------------------------------------
-- A deletes their own profile (FR-005): profile, membership and medications go.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select lives_ok(
  $$select public.delete_profile(current_setting('test.profile_a2')::uuid)$$,
  'A can delete their own profile'
);
select lives_ok(
  $$select public.delete_profile(current_setting('test.profile_a2')::uuid)$$,
  'Deleting an already deleted profile does not raise'
);
select lives_ok(
  $$select public.delete_profile('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)$$,
  'delete_profile() of an unknown id does not raise'
);

reset role;

select is_empty(
  $$select 1 from public.profiles where id = current_setting('test.profile_a2')::uuid$$,
  'A''s deleted profile is gone'
);
select is_empty(
  $$select 1 from public.profile_caregivers where profile_id = current_setting('test.profile_a2')::uuid$$,
  'A''s membership of the deleted profile is gone'
);
select is_empty(
  $$select 1 from public.medications where profile_id = current_setting('test.profile_a2')::uuid$$,
  'The deleted profile''s medications are gone'
);

-- ---------------------------------------------------------------------------
-- Shared profile: the last caregiver to detach deletes it.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select lives_ok(
  $$select public.delete_profile(current_setting('test.profile_shared')::uuid)$$,
  'A can detach from a shared profile'
);

reset role;

select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_shared')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'Only A''s membership of the shared profile was removed'
);
select results_eq(
  $$select p.name, m.name
    from public.profiles p
    join public.medications m on m.profile_id = p.id
    where p.id = current_setting('test.profile_shared')::uuid$$,
  $$select 'Grandpa'::text, 'Shared pill'::text$$,
  'The shared profile and its medication remain while B still belongs to it'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select lives_ok(
  $$select public.delete_profile(current_setting('test.profile_shared')::uuid)$$,
  'B, the last caregiver, can delete the shared profile'
);

reset role;

select is_empty(
  $$select 1 from public.profiles where id = current_setting('test.profile_shared')::uuid$$,
  'The shared profile is gone after its last caregiver detaches'
);
select is_empty(
  $$select 1 from public.profile_caregivers where profile_id = current_setting('test.profile_shared')::uuid$$,
  'No memberships of the shared profile remain'
);
select is_empty(
  $$select 1 from public.medications where profile_id = current_setting('test.profile_shared')::uuid$$,
  'The shared profile''s medications are gone'
);

-- ---------------------------------------------------------------------------
-- delete_profile() needs a signed-in user.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);

select throws_ok(
  $$select public.delete_profile(current_setting('test.profile_b')::uuid)$$,
  '42501',
  'Not authenticated',
  'delete_profile() raises without a signed-in user'
);

-- ---------------------------------------------------------------------------
-- anon cannot delete anything.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok(
  $$select public.delete_profile(current_setting('test.profile_b')::uuid)$$,
  '42501', null, 'anon cannot execute delete_profile()'
);
select throws_ok(
  $$delete from public.medications where profile_id = current_setting('test.profile_b')::uuid$$,
  '42501', null, 'anon cannot delete medications'
);
select throws_ok(
  $$update public.profiles set name = 'Anon' where id = current_setting('test.profile_b')::uuid$$,
  '42501', null, 'anon cannot update profiles'
);

-- ---------------------------------------------------------------------------
-- Ground truth as postgres: B's profile and medication are untouched.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select p.name, m.name
    from public.profiles p
    join public.medications m on m.profile_id = p.id
    where p.id = current_setting('test.profile_b')::uuid$$,
  $$select 'Me'::text, 'Vitamin D'::text$$,
  'B''s profile and medication are untouched'
);
select policies_are(
  'public',
  'profiles',
  array[
    'Caregivers can read profiles they belong to',
    'Caregivers can update profiles they belong to'
  ],
  'profiles has select and update policies only'
);
select policies_are(
  'public',
  'profile_caregivers',
  array['Caregivers can read their own memberships'],
  'profile_caregivers keeps its single select policy'
);

select * from finish();
rollback;
