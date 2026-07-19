-- =============================================================================
-- Migration: 0015_inventory_copy_label
-- Adds a free-text label to user_inventory, letting the user manually
-- distinguish between multiple copies of the same card (e.g.
-- "English", "Chinese", "1st Edition", "PSA 10") rather than only
-- ever seeing an automatic, meaningless "Copy 1"/"Copy 2".
--
-- Deliberately separate from the existing `language` field — language
-- is a fixed, structured field (a dropdown of real print languages),
-- but a copy label is free text and might describe anything the user
-- wants to distinguish it by, not just language.
-- =============================================================================

alter table public.user_inventory add column label text;