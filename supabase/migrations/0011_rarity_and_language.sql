-- =============================================================================
-- Migration: 0014_rarity_and_language
-- Adds two new fields, both nullable:
--   - card_definitions.rarity — free text (not a fixed enum), since
--     different TCG franchises use very different rarity naming
--     systems (Pokémon vs Yu-Gi-Oh vs One Piece etc.) that don't map
--     onto one shared list. Lives on the card itself, shared across
--     every owned copy — rarity is intrinsic to the card, not the
--     physical copy.
--   - user_inventory.language — per COPY, not per card, since two
--     copies of the same card can genuinely be different print
--     languages. Constrained to a known set of language codes at the
--     application layer (see LANGUAGE_OPTIONS in inventory.types.js),
--     not a DB-level check constraint, matching how condition_rating
--     is already handled.
-- =============================================================================

alter table public.card_definitions add column rarity text;
alter table public.user_inventory   add column language text;