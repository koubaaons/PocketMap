-- =============================================================================
-- Migration: 0013_bin_entity_type_inventory_item
-- Fixes a real gap: bin.entity_type has a check constraint only
-- allowing ('binder','collection','cardDef') — added back when only
-- those three entity types could ever be soft-deleted. Quantity
-- tracking introduced a fourth ('inventoryItem', a single removed
-- copy), and this constraint was never updated to allow it —
-- confirmed via the actual 400 error this produced on every bin
-- upsert for a removed copy.
-- =============================================================================

alter table public.bin drop constraint if exists bin_entity_type_check;

alter table public.bin
  add constraint bin_entity_type_check
  check (entity_type in ('binder', 'collection', 'cardDef', 'inventoryItem'));