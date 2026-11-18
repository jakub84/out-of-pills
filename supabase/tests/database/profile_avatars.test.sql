-- Avatar rule and privacy guardrail for profiles.avatar and the four-argument
-- create_profile().
-- Run with: npx supabase test db
begin;

select plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): user A and B with a name, user C without one.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.com', 'authenticated', 'authenticated');

-- Act as user B.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

insert into public.caregivers (user_id, display_name)
values ('00000000-0000-0000-0000-00000000000b', 'Bob');
select set_config('test.profile_b', public.create_profile('Dad', 'parent', 'slate', 'dad')::text, true);

-- Act as user A.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

insert into public.caregivers (user_id, display_name)
values ('00000000-0000-0000-0000-00000000000a', 'Anna');
select set_config('test.profile_plain', public.create_profile('Plain', 'parent', 'sand')::text, true);
select set_config('test.profile_mom', public.create_profile('Mom', 'parent', 'mint', 'mom')::text, true);

-- ---------------------------------------------------------------------------
-- Both signatures work and store the expected avatar.
-- ---------------------------------------------------------------------------
select is(
  (select avatar from public.profiles where id = current_setting('test.profile_plain')::uuid),
  null::text,
  'The three-argument create_profile() stores a null avatar'
);
select is(
  (select avatar from public.profiles where id = current_setting('test.profile_mom')::uuid),
  'mom',
  'The four-argument create_profile() stores a matching avatar'
);
select lives_ok(
  $$select public.create_profile('Me', 'me', 'rose', 'woman')$$,
  'A "me" profile accepts a "me" avatar'
);
select lives_ok(
  $$select public.create_profile('Son', 'child', 'stone', 'son')$$,
  'A "child" profile accepts a "child" avatar'
);
select lives_ok(
  $$select public.create_profile('Rex', 'other', 'lavender', 'dog')$$,
  'An "other" profile accepts an "other" avatar'
);

-- ---------------------------------------------------------------------------
-- Avatars outside the profile kind's set are rejected.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.create_profile('Mismatch', 'me', 'mint', 'mom')$$,
  '23514',
  null,
  'A "parent" avatar is rejected for a "me" profile'
);
select throws_ok(
  $$select public.create_profile('Mismatch', 'child', 'mint', 'cat')$$,
  '23514',
  null,
  'An "other" avatar is rejected for a "child" profile'
);
select throws_ok(
  $$select public.create_profile('Unknown', 'other', 'mint', 'robot')$$,
  '23514',
  null,
  'An unknown avatar is rejected'
);
select throws_ok(
  $$select public.create_profile('Empty', 'other', 'mint', '')$$,
  '23514',
  null,
  'An empty avatar is rejected'
);

-- ---------------------------------------------------------------------------
-- Another caregiver cannot read the avatar.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select is_empty(
  $$select avatar from public.profiles where id = current_setting('test.profile_mom')::uuid$$,
  'B cannot read A''s avatar by profile id'
);
select results_eq(
  'select avatar from public.profiles',
  $$values ('dad'::text)$$,
  'B sees only their own avatars'
);

-- ---------------------------------------------------------------------------
-- The new function keeps the caregiver and authentication checks.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text, true);

select throws_ok(
  $$select public.create_profile('Orphan', 'other', 'stone', 'cat')$$,
  'P0001',
  'Caregiver name is not set',
  'The four-argument create_profile() raises for a caller without a caregivers row'
);

select set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);

select throws_ok(
  $$select public.create_profile('NoUser', 'other', 'stone', 'cat')$$,
  '42501',
  'Not authenticated',
  'The four-argument create_profile() raises without a signed-in user'
);

-- ---------------------------------------------------------------------------
-- anon cannot execute the new function.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok(
  $$select public.create_profile('Anon', 'other', 'mint', 'cat')$$,
  '42501',
  null,
  'anon cannot execute the four-argument create_profile()'
);

-- ---------------------------------------------------------------------------
-- Ground truth as postgres.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_mom')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'The four-argument create_profile() linked A''s profile only to A'
);
select results_eq(
  $$select user_id from public.profile_caregivers where profile_id = current_setting('test.profile_b')::uuid$$,
  $$values ('00000000-0000-0000-0000-00000000000b'::uuid)$$,
  'The four-argument create_profile() linked B''s profile only to B'
);
select is_empty(
  $$select 1 from public.profiles
    where name in ('Mismatch', 'Unknown', 'Empty', 'Orphan', 'NoUser', 'Anon')$$,
  'Rejected calls created no profiles'
);

-- The check also holds for writes that bypass create_profile().
select throws_ok(
  $$insert into public.profiles (name, kind, avatar_color, avatar)
    values ('Direct', 'child', 'mint', 'mom')$$,
  '23514',
  null,
  'The check constraint rejects a mismatched avatar on a direct insert'
);

select * from finish();
rollback;
