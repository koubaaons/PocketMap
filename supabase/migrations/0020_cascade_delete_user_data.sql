-- =============================================================================
-- Migration: 0020_cascade_delete_user_data
--
-- Adds ON DELETE CASCADE to every user_id foreign key that was
-- missing it. binder_panels, binder_inserts, and user_preferences
-- (all added in later migrations) already had this set up correctly;
-- only the original 8 tables from 0001_initial_schema.sql didn't.
--
-- This is what makes real account deletion possible at all: deleting
-- the auth.users row (via the delete-account Edge Function, since
-- that specific operation requires the service role key and can
-- never be done from client-side code) now automatically cascades to
-- delete every row across every one of these tables for that user,
-- with no separate delete call needed per table.
--
-- Postgres auto-names an inline `references` constraint as
-- {table}_{column}_fkey by default — none of these were given an
-- explicit name in the original migration, so that's the name each
-- DROP below targets.
--
-- One deliberate judgment call: beta_feedback's user_id is nullable
-- (feedback isn't required to be tied to an account), but it's
-- cascaded here too, on the reasoning that "delete my account" should
-- mean everything tied to that account is genuinely gone, not just
-- most of it.
-- =============================================================================

alter table public.collections
  drop constraint collections_user_id_fkey,
  add constraint collections_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.binders
  drop constraint binders_user_id_fkey,
  add constraint binders_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.card_definitions
  drop constraint card_definitions_user_id_fkey,
  add constraint card_definitions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.template_fields
  drop constraint template_fields_user_id_fkey,
  add constraint template_fields_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.binder_slots
  drop constraint binder_slots_user_id_fkey,
  add constraint binder_slots_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.user_inventory
  drop constraint user_inventory_user_id_fkey,
  add constraint user_inventory_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.bin
  drop constraint bin_user_id_fkey,
  add constraint bin_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.beta_feedback
  drop constraint beta_feedback_user_id_fkey,
  add constraint beta_feedback_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;