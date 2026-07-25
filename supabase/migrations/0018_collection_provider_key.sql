-- =============================================================================
-- Migration: 0018_collection_provider_key
--
-- Records WHICH provider a collection's external_set_id/card ids
-- actually belong to — without this, swapping the active TCG
-- provider later (or adding a second one) would have no way to tell
-- "this collection's IDs are from the old, now-inactive API" apart
-- from the new one, and would either fail outright when trying to
-- refetch, or worse, misread every card in the new provider's
-- response as "new" since none of its ids would match what's stored.
--
-- Existing collections (created before this column existed) will
-- have provider_key = null. Since there's only ever been one active
-- provider up to this point, null is treated as "matches whichever
-- provider is currently active" at the application layer (see
-- useCollectionUpdateCheck.js) — a safe assumption today, but one
-- that stops applying the moment a second provider is ever
-- introduced, which is exactly why every NEW collection going
-- forward is stamped with its real provider_key at creation time.
-- =============================================================================

alter table public.collections
  add column if not exists provider_key text;
