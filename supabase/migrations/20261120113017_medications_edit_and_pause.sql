-- Edit and pause (S-07): a caregiver renames a medication, changes its daily
-- dose, and pauses or resumes it. Additive only: earlier migrations stay as
-- pushed. The update policy from 20261117120803_medications_stock_updates.sql
-- already scopes rows to the caller's profiles.
--
-- A dose or pause change only stays correct when the stock baseline is
-- rebased at the same time (pills left today, counted today), so the
-- "counted today" trigger now covers daily_dose and paused_on too: a dose or
-- pause change on a baseline counted on an earlier day raises OP001.

-- ---------------------------------------------------------------------------
-- Pause state: the Warsaw day the medication was paused, null when taken.
-- A pause always comes with a baseline counted that day, so it can never be
-- later than counted_on. Existing rows stay unpaused (null).
-- ---------------------------------------------------------------------------
alter table public.medications
  add column paused_on date,
  add constraint medications_paused_on_not_after_counted_on
    check (paused_on is null or paused_on <= counted_on);

-- S-07 opens name, dose and pause state for update. The insert grant stays
-- unchanged, so a new medication always starts unpaused.
grant update (name, daily_dose, paused_on) on table public.medications to authenticated;

-- ---------------------------------------------------------------------------
-- counted_on stays the database's own date: a new baseline, a dose change or
-- a pause change must be dated today in Europe/Warsaw, and a pause can only
-- start today. A stale date (e.g. a write landing just after midnight) raises
-- OP001 so the app can ask the user to check and retry. The trigger binding
-- (before update, every column) and the revoked EXECUTE stay as they are.
-- ---------------------------------------------------------------------------
create or replace function public.medications_stock_counted_today()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if (new.pills_counted is distinct from old.pills_counted
      or new.counted_on is distinct from old.counted_on
      or new.daily_dose is distinct from old.daily_dose
      or new.paused_on is distinct from old.paused_on)
     and new.counted_on is distinct from today
  then
    raise exception 'counted_on must be today''s date in Europe/Warsaw'
      using errcode = 'OP001';
  end if;

  if new.paused_on is distinct from old.paused_on
     and new.paused_on is not null
     and new.paused_on is distinct from today
  then
    raise exception 'paused_on must be today''s date in Europe/Warsaw'
      using errcode = 'OP001';
  end if;

  return new;
end;
$$;
