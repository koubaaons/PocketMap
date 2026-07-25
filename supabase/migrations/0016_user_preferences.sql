-- =============================================================================
-- Migration: 0016_user_preferences
--
-- New per-account table backing two features:
--
-- Issue #135 (Seed Loader on First Launch): a brand-new account with
-- zero collections gets the most-recently-released set auto-imported
-- as a starter collection, so there's something to explore
-- immediately instead of an empty app. seeded_starter_collection
-- guards this to run exactly once per account, ever — checked
-- server-side (not just a localStorage flag) so it can't accidentally
-- re-run just because someone signs in on a different device, or
-- because they later delete their only collection.
--
-- Issue #134 (new-set detection, checked on open rather than a real
-- server-side scheduled job — see this project's own notes on that
-- decision): known_set_ids tracks every set id the account has ever
-- been shown, so a fresh fetch can diff against it and surface
-- exactly what's actually new, rather than assuming "new" always
-- means "released after the last known date" (a reprint/historical
-- set added to the API later wouldn't be chronologically newest, but
-- would still be new to this account). last_new_set_check_at caps
-- this check to once per day rather than every single page load.
-- =============================================================================

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seeded_starter_collection boolean not null default false,
  last_new_set_check_at timestamptz,
  known_set_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users manage their own preferences"
on public.user_preferences for all
using ( auth.uid() = user_id )
with check ( auth.uid() = user_id );
