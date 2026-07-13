-- =============================================================================
-- Migration: 0002_create_card_images_bucket
-- Issue #125: Supabase Storage Migration — Base64 Images → Storage URLs
--
-- Creates the card-images Storage bucket with public read access (anyone
-- can view a card image via its URL, same as any other public CDN asset)
-- and authenticated write access (only logged-in users can upload).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true);

-- Public read — anyone can view an image at its URL, no auth required.
create policy "Public read access on card-images"
on storage.objects for select
using ( bucket_id = 'card-images' );

-- Authenticated users can upload new images.
create policy "Authenticated users can upload card images"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'card-images' );

-- Authenticated users can overwrite/update images (upsert:true in the
-- app's upload helper relies on this for re-running the base64 migration
-- safely against a path that may have partially succeeded before).
create policy "Authenticated users can update card images"
on storage.objects for update
to authenticated
using ( bucket_id = 'card-images' );