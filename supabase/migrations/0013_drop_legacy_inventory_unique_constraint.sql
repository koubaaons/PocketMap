-- =============================================================================
-- Migration: 0016_drop_legacy_inventory_unique_constraint
--
-- Fixes the "Add Another Copy" bug: adding a second physical copy of a
-- card looks fine locally (it shows up immediately, the local reducer
-- has always supported multiple inventory rows per card — see
-- reducer.js's INVENTORY_ADD comment), but disappears the moment the
-- page is refreshed and state gets re-hydrated from Supabase.
--
-- Cause: user_inventory still carries a UNIQUE constraint on
-- card_def_id (per user) from back when ownership was a plain
-- boolean — one row per card, ever. Quantity tracking made owning
-- multiple copies of the same card a real, intentional feature, and
-- the reducer's own single-copy rejection was removed to match, but
-- the matching database-level constraint was apparently never
-- dropped (this repo's migration history has a gap — 0010 through
-- 0012 are missing entirely, and this looks like the fix that should
-- have shipped in one of them).
--
-- Effect: every "Add Another Copy" upsert for a card that already has
-- an inventory row silently fails with a unique-violation (only ever
-- logged to the console, per supabaseSync.js's upsertInventoryItem —
-- nothing surfaces it to the user), so the copy exists only in
-- in-memory state until the next Supabase re-hydrate wipes it out.
--
-- This finds and drops whatever that constraint is actually named in
-- production (rather than guessing a literal name, since it may have
-- been added by hand rather than through a committed migration) and
-- is safe to run even if it's already gone.
-- =============================================================================

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel      on rel.oid = con.conrelid
  join pg_namespace nsp  on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'user_inventory'
    and con.contype = 'u'
    -- Match either a plain (card_def_id) unique constraint or a
    -- composite (user_id, card_def_id) one — whichever form the
    -- legacy single-ownership constraint actually took.
    and (
      con.conkey = (select array_agg(attnum order by attnum) from pg_attribute
                    where attrelid = rel.oid and attname = 'card_def_id')
      or con.conkey = (select array_agg(attnum order by attnum) from pg_attribute
                       where attrelid = rel.oid and attname in ('user_id', 'card_def_id'))
    )
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.user_inventory drop constraint %I', constraint_name);
  end if;
end $$;
