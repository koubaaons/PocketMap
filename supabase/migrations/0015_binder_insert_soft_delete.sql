-- =============================================================================
-- Migration: 0015_binder_insert_soft_delete
--
-- Adds soft-delete support to binder_inserts (the Michi Method image
-- library) so removing an image from the library goes to Trash first
-- (recoverable) instead of being destroyed immediately — matching
-- every other deletable entity in this app (binders, collections,
-- cards). Also extends bin.entity_type to allow 'insert', the same
-- way 0010_bin_entity_type_inventory_item.sql extended it for
-- 'inventoryItem'.
-- =============================================================================

alter table public.binder_inserts
  add column if not exists deleted_at timestamptz;

alter table public.bin drop constraint if exists bin_entity_type_check;

alter table public.bin
  add constraint bin_entity_type_check
  check (entity_type in ('binder', 'collection', 'cardDef', 'inventoryItem', 'insert'));
