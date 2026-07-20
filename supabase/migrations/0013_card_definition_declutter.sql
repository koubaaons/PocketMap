-- =============================================================================
-- Migration: 0014_card_definition_declutter
--
-- Adds card decluttering: a way to hide a card definition everywhere
-- (Owned/Missing/Unorganised/Cards tabs) without deleting it — the
-- card and its ownership data stay completely intact, it just moves
-- to a dedicated "Decluttered" tab until restored.
-- =============================================================================

alter table public.card_definitions
  add column if not exists is_decluttered boolean not null default false;