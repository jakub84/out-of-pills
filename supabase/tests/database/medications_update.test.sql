-- Restock, correction, edit and pause: only the profile's caregiver rewrites
-- the stock baseline (pills_counted / counted_on, only as of today), package
-- size, name, daily dose and pause state. Dose and pause changes need a
-- baseline counted today, and a pause can only start today.
-- Run with: npx supabase test db
begin;

select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures: user A and B, each with a profile and one medication.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
insert into public.caregivers (user_id, display_name) values ('00000000-0000-0000-0000-00000000000a', 'Anna');
select set_config('test.profile_a', public.create_profile('Mom', 'parent', 'mint')::text, true);
insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
values (current_setting('test.profile_a')::uuid, 'Metformax', 30, 18, 2);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
insert into public.caregivers (user_id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'Bob');
select set_config('test.profile_b', public.create_profile('Me', 'me', 'rose')::text, true);
insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose)
values (current_setting('test.profile_b')::uuid, 'Vitamin D', 60, 40, 1);

reset role;
select set_config('test.med_a', (select id::text from public.medications where name = 'Metformax'), true);
select set_config('test.today', ((now() at time zone 'Europe/Warsaw')::date)::text, true);

-- ---------------------------------------------------------------------------
-- A rewrites the stock baseline of their own medication.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select lives_ok(
  $$update public.medications
    set pills_counted = 48, counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'A can set pills_counted and counted_on (today) on their own medication'
);
select results_eq(
  $$select pills_counted, counted_on from public.medications where id = current_setting('test.med_a')::uuid$$,
  $$select 48::numeric, current_setting('test.today')::date$$,
  'A''s new baseline is stored'
);

-- Stale-submit guard: a conditional update on an old baseline matches nothing.
update public.medications
  set pills_counted = 78, counted_on = current_setting('test.today')::date
  where id = current_setting('test.med_a')::uuid and pills_counted = 18;
select results_eq(
  $$select pills_counted from public.medications where id = current_setting('test.med_a')::uuid$$,
  $$select 48::numeric$$,
  'A conditional update with a non-matching pills_counted changes nothing'
);

-- Edit (S-07): rename and change the dose together with a today-dated count.
select lives_ok(
  $$update public.medications
    set name = 'Metformax XR', daily_dose = 1, pills_counted = 40,
        counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'A can rename and change the dose together with a count dated today'
);
select results_eq(
  $$select name, daily_dose, pills_counted from public.medications where id = current_setting('test.med_a')::uuid$$,
  $$select 'Metformax XR'::text, 1::numeric, 40::numeric$$,
  'A''s new name, dose and count are stored'
);

-- Name and dose constraints still apply on update.
select throws_ok(
  $$update public.medications set name = '   ' where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A blank name is rejected on update'
);
select throws_ok(
  $$update public.medications set name = repeat('a', 81) where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A name longer than 80 characters is rejected on update'
);
select throws_ok(
  $$update public.medications set daily_dose = 1.3 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A daily dose that is not a multiple of 0.5 is rejected on update'
);
select throws_ok(
  $$update public.medications set daily_dose = 0 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A daily dose of 0 is rejected on update'
);
select throws_ok(
  $$update public.medications set daily_dose = 50.5 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A daily dose above 50 is rejected on update'
);

-- Pause (S-07): only as of today, together with a count dated today.
select lives_ok(
  $$update public.medications
    set paused_on = current_setting('test.today')::date, pills_counted = 39,
        counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'A can pause their medication today together with a count dated today'
);
select results_eq(
  $$select paused_on from public.medications where id = current_setting('test.med_a')::uuid$$,
  $$select current_setting('test.today')::date$$,
  'A''s pause date is stored'
);
select lives_ok(
  $$update public.medications
    set paused_on = null, counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'A can resume their medication today'
);
select throws_ok(
  $$update public.medications
    set paused_on = current_setting('test.today')::date - 1,
        counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'paused_on yesterday is rejected with OP001'
);

-- New medications start unpaused: paused_on is not in the insert grant.
select throws_ok(
  $$insert into public.medications (profile_id, name, package_size, pills_counted, daily_dose, paused_on)
    values (current_setting('test.profile_a')::uuid, 'Paused', 30, 30, 1, current_setting('test.today')::date)$$,
  '42501', null, 'A cannot set paused_on on insert'
);
-- The remembered package size is writable (saved with a restock), within 1–1000.
select lives_ok(
  $$update public.medications set package_size = 60 where id = current_setting('test.med_a')::uuid$$,
  'A can update package_size'
);
select throws_ok(
  $$update public.medications set package_size = 0 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A package size of 0 is rejected on update'
);
select throws_ok(
  $$update public.medications set package_size = 1001 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A package size of 1001 is rejected on update'
);
select throws_ok(
  $$update public.medications set profile_id = current_setting('test.profile_b')::uuid
    where id = current_setting('test.med_a')::uuid$$,
  '42501', null, 'A cannot update profile_id'
);

-- The date is owned by the database: only today is accepted.
select throws_ok(
  $$update public.medications
    set pills_counted = 10, counted_on = current_setting('test.today')::date - 1
    where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'counted_on yesterday is rejected with OP001'
);
select throws_ok(
  $$update public.medications
    set pills_counted = 10, counted_on = current_setting('test.today')::date + 1
    where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'counted_on tomorrow is rejected with OP001'
);

-- Check constraints still apply on update.
select throws_ok(
  $$update public.medications set pills_counted = 0.3 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A pill count that is not a multiple of 0.5 is rejected on update'
);
select throws_ok(
  $$update public.medications set pills_counted = 10000 where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'A pill count of 10000 is rejected on update'
);
select lives_ok(
  $$update public.medications set pills_counted = 0 where id = current_setting('test.med_a')::uuid$$,
  'A can correct the count to 0'
);

-- ---------------------------------------------------------------------------
-- A baseline counted yesterday cannot get a new count without today's date.
-- ---------------------------------------------------------------------------
reset role;
alter table public.medications disable trigger medications_stock_counted_today;
update public.medications
  set pills_counted = 18, counted_on = current_setting('test.today')::date - 1
  where id = current_setting('test.med_a')::uuid;
-- A pause can never be later than the baseline it froze.
select throws_ok(
  $$update public.medications set paused_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  '23514', null, 'paused_on later than counted_on violates the check'
);
alter table public.medications enable trigger medications_stock_counted_today;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select throws_ok(
  $$update public.medications set pills_counted = 48 where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'Changing pills_counted alone on a row counted yesterday is rejected with OP001'
);
select throws_ok(
  $$update public.medications set daily_dose = 2 where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'Changing daily_dose alone on a row counted yesterday is rejected with OP001'
);
select throws_ok(
  $$update public.medications set paused_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'OP001', null, 'Pausing without a new count on a row counted yesterday is rejected with OP001'
);
select lives_ok(
  $$update public.medications set name = 'Metformin' where id = current_setting('test.med_a')::uuid$$,
  'Renaming alone does not need a new count'
);

-- ---------------------------------------------------------------------------
-- B cannot rewrite A's stock.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);

select lives_ok(
  $$update public.medications
    set pills_counted = 999, counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'B''s update of A''s medication runs without error (matches no rows)'
);
select lives_ok(
  $$update public.medications set package_size = 500 where id = current_setting('test.med_a')::uuid$$,
  'B''s package size update of A''s medication runs without error (matches no rows)'
);
select lives_ok(
  $$update public.medications
    set name = 'Hijacked', daily_dose = 5, paused_on = current_setting('test.today')::date,
        counted_on = current_setting('test.today')::date
    where id = current_setting('test.med_a')::uuid$$,
  'B''s edit and pause of A''s medication runs without error (matches no rows)'
);
select lives_ok(
  $$update public.medications
    set pills_counted = 999, counted_on = current_setting('test.today')::date
    where profile_id = current_setting('test.profile_b')::uuid$$,
  'B can update their own medication'
);

-- ---------------------------------------------------------------------------
-- anon cannot update at all.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok(
  $$update public.medications set pills_counted = 1 where id = current_setting('test.med_a')::uuid$$,
  '42501', null, 'anon cannot update medications'
);

-- ---------------------------------------------------------------------------
-- Ground truth as postgres.
-- ---------------------------------------------------------------------------
reset role;

select results_eq(
  $$select pills_counted, counted_on, package_size, name, daily_dose, paused_on
    from public.medications where id = current_setting('test.med_a')::uuid$$,
  $$select 18::numeric, current_setting('test.today')::date - 1, 60, 'Metformin'::text, 1::numeric, null::date$$,
  'B''s updates and the rejected updates left A''s medication unchanged'
);
select results_eq(
  $$select pills_counted from public.medications where profile_id = current_setting('test.profile_b')::uuid$$,
  $$select 999::numeric$$,
  'B''s own update was applied'
);
select policies_are(
  'public',
  'medications',
  array[
    'Caregivers can read medications of their profiles',
    'Caregivers can add medications to their profiles',
    'Caregivers can update stock of their profiles'' medications',
    'Caregivers can delete medications of their profiles'
  ],
  'medications has select, insert, update and delete policies only'
);

select * from finish();
rollback;
