-- =============================================================================
-- Migration: 0007_soft_delete_columns
-- Issue #126: Schema Version Control — Commit Migration Files
--
-- The ALTER TABLE statements that added soft-delete support during
-- Milestone 11, run manually in the SQL Editor at the time and never
-- committed. Verified against the live schema via information_schema.
-- columns — exactly these four tables have deleted_at; binder_slots
-- and template_fields deliberately do not (they're always cleaned up
-- as part of their parent's own cascade, never soft-deleted on their
-- own).
-- =============================================================================

alter table public.binders           add column deleted_at timestamptz null;
alter table public.collections       add column deleted_at timestamptz null;
alter table public.card_definitions  add column deleted_at timestamptz null;
alter table public.user_inventory    add column deleted_at timestamptz null;