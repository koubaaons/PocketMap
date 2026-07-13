-- =============================================================================
-- Migration: 0004_card_images_delete_policy
-- Issue #125 follow-up: storage cleanup on card/sticker deletion
--
-- 0002_create_card_images_bucket.sql created SELECT, INSERT, and UPDATE
-- policies on storage.objects for this bucket, but never a DELETE policy.
-- Without it, every call to supabase.storage.from('card-images').remove(...)
-- is silently blocked by RLS — the application code (deleteImageFromStorage
-- in supabaseImageUpload.js) was correct, but had no permission to actually
-- do anything.
-- =============================================================================

create policy "Authenticated users can delete card images"
on storage.objects for delete
to authenticated
using ( bucket_id = 'card-images' );