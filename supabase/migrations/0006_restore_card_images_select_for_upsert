-- =============================================================================
-- Migration: 0006_restore_card_images_select_for_upsert
-- Corrects a mistake in 0005_restrict_card_images_listing.sql
--
-- 0005 dropped the SELECT policy on storage.objects for this bucket,
-- reasoning that public buckets serve file downloads without going
-- through RLS, so SELECT only controlled the listing/browsing API,
-- which the app never uses. That reasoning was incomplete: Storage's
-- upload() with { upsert: true } needs to check whether a file
-- already exists at the target path before deciding to insert or
-- update it, and that existence check requires SELECT permission —
-- without it, every upload failed outright with "new row violates
-- row-level security policy", even for a path that had never been
-- used before.
--
-- Restoring SELECT access for authenticated users only (not "public"
-- like the original 0002 policy) is enough to fix uploads, while still
-- keeping anonymous/unauthenticated clients from listing the bucket's
-- contents — a middle ground between 0002's original blanket policy
-- and 0005's overly aggressive removal.
-- =============================================================================

create policy "Authenticated users can list card images"
on storage.objects for select
to authenticated
using ( bucket_id = 'card-images' );