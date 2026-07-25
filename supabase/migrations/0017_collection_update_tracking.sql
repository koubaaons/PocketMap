-- =============================================================================
-- Migration: 0017_collection_update_tracking
--
-- Adds the fields needed to detect when a set that's already been
-- imported gets new cards added to it by the API (e.g. a delayed
-- secret rare reveal, errata), and to import just those new cards
-- into the EXISTING collection as unowned — without touching any
-- already-owned copy, favorite, or binder placement.
--
-- card_definitions.external_card_id: the stable id this card has in
-- its source API (e.g. "base1-4"). Matching by name alone risks
-- conflating reprints or alternate arts that legitimately share a
-- name — this is what actually lets a re-check tell "a card I
-- already have" apart from "a genuinely new card".
--
-- collections.external_set_id: the machine-readable set id this
-- collection was imported from (e.g. "base1") — distinct from
-- import_source, which is a human-readable display label ("Pokémon
-- TCG: Base Set"), not something safe to refetch by.
--
-- collections.known_external_card_ids: every external card id this
-- collection has ever been shown as available (whether actually
-- imported or dismissed without importing), so a dismissed "new
-- cards available" notification doesn't reappear on every
-- subsequent daily check.
--
-- user_preferences.last_collection_update_check_at: caps this check
-- to once per day, same reasoning as last_new_set_check_at (#134) —
-- kept as a SEPARATE column since this check runs against a
-- different, per-collection question ("did an already-imported set
-- change?") rather than #134's ("does a brand new set exist?"); using
-- one shared timestamp for both would let whichever ran first block
-- the other from running the same day.
-- =============================================================================

alter table public.card_definitions
  add column if not exists external_card_id text;

alter table public.collections
  add column if not exists external_set_id text,
  add column if not exists known_external_card_ids jsonb not null default '[]'::jsonb;

alter table public.user_preferences
  add column if not exists last_collection_update_check_at timestamptz;
