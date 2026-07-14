-- =============================================================================
-- Migration: 0005_restrict_card_images_listing
-- Issue #125 follow-up: address Supabase's own "clients can list all
-- files in this bucket" warning
--
-- The SELECT policy from 0002 allowed listing/browsing every object in
-- the bucket via the Storage API, not just fetching a specific known
-- URL. Public buckets serve individual file downloads without going
-- through RLS at all (that's what "public" means) — this policy only
-- ever controlled the listing/browsing API, which the app never uses
-- (it only ever fetches specific URLs already stored in the database).
-- Removing it closes off bucket-enumeration with zero functional cost.
-- =============================================================================

drop policy "Public read access on card-images" on storage.objects;