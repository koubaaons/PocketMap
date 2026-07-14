-- =============================================================================
-- Migration: 0008_realtime_publications
-- Issue #126: Schema Version Control — Commit Migration Files
-- Issue #118: Multi-Device Sync
--
-- The ALTER PUBLICATION statements that added these seven tables to
-- Supabase's realtime publication, enabling useSupabaseSync.js's
-- postgres_changes subscription. Run manually at the time, never
-- committed. Verified directly against the live database via:
--   select schemaname, tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' order by tablename;
-- which returned exactly these seven tables — beta_feedback is
-- deliberately not included, since it doesn't need live cross-device
-- sync the way user data does.
-- =============================================================================

alter publication supabase_realtime add table public.bin;
alter publication supabase_realtime add table public.binder_slots;
alter publication supabase_realtime add table public.binders;
alter publication supabase_realtime add table public.card_definitions;
alter publication supabase_realtime add table public.collections;
alter publication supabase_realtime add table public.template_fields;
alter publication supabase_realtime add table public.user_inventory;