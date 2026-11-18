-- Restock and correction (S-06): a caregiver rewrites the stock baseline of
-- their own profiles' medications — a new pills_counted counted today.
-- Additive only: the medications migration stays as pushed.

-- ---------------------------------------------------------------------------
-- Update policy: same profile membership as select and insert.
-- ---------------------------------------------------------------------------
create policy "Caregivers can update stock of their profiles' medications"
  on public.medications for update
  to authenticated
  using (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = medications.profile_id
        and pc.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.profile_caregivers pc
      where pc.profile_id = medications.profile_id
        and pc.user_id = (select auth.uid())
    )
  );

-- Only the stock baseline is writable; name, dose, package size and profile
-- stay read-only until the slices that edit them.
grant update (pills_counted, counted_on) on table public.medications to authenticated;

-- ---------------------------------------------------------------------------
-- counted_on stays the database's own date: a new baseline must be dated
-- today in Europe/Warsaw. A stale date (e.g. a write landing just after
-- midnight) raises OP001 so the app can ask the user to check and retry.
-- ---------------------------------------------------------------------------
create function public.medications_stock_counted_today()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.pills_counted is distinct from old.pills_counted
      or new.counted_on is distinct from old.counted_on)
     and new.counted_on is distinct from (now() at time zone 'Europe/Warsaw')::date
  then
    raise exception 'counted_on must be today''s date in Europe/Warsaw'
      using errcode = 'OP001';
  end if;
  return new;
end;
$$;

create trigger medications_stock_counted_today
  before update on public.medications
  for each row
  execute function public.medications_stock_counted_today();

-- Trigger functions run without EXECUTE; nobody needs to call it directly.
revoke execute on function public.medications_stock_counted_today() from public, anon, authenticated;
