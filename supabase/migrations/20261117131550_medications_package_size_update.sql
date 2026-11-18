-- Restock (S-06): the add-package dialog can save a new remembered package
-- size together with the restock. Additive only: the update policy from
-- 20261117120803_medications_stock_updates.sql already scopes rows to the
-- caller's profiles, and the package_size check (1–1000) still applies.
-- Name, dose and profile stay read-only until the slices that edit them.

grant update (package_size) on table public.medications to authenticated;
