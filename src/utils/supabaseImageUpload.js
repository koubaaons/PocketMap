/**
 * @fileoverview Shared helper for uploading images to Supabase Storage.
 * === ISSUE #125: Supabase Storage Migration ===
 *
 * Every image write (new card uploads, and the base64→Storage migration
 * script) goes through this one function, so there's a single place
 * that knows how to talk to the card-images bucket and construct its
 * public URL — no other file should call supabase.storage directly.
 *
 * Requires VITE_SUPABASE_STORAGE_URL in .env.local, pointing at the
 * bucket's public base URL (see the bucket setup instructions given
 * alongside this file) — this is what "storage URLs are never
 * hardcoded" means: the base URL lives in one env var, not scattered
 * across every place a URL gets constructed.
 */

import { supabase } from '../services/supabase.js';

export const CARD_IMAGES_BUCKET = 'card-images';

const storageBaseUrl = import.meta.env.VITE_SUPABASE_STORAGE_URL;

if (!storageBaseUrl) {
  throw new Error(
    '[Pinder] Missing VITE_SUPABASE_STORAGE_URL.\n' +
    'Add this to .env.local, pointing at the card-images bucket\'s public base URL:\n' +
    '  VITE_SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1/object/public/card-images'
  );
}

/**
 * Converts a base64 data URL (e.g. "data:image/jpeg;base64,...") into a
 * Blob, so it can be uploaded via the Storage API the same way a real
 * File would be. Browser-native APIs only — no library needed.
 */
export function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Uploads an image (base64 data URL or a Blob/File) to the card-images
 * bucket at the given path and returns its public URL. upsert:true so
 * re-uploading the same path (e.g. re-running the migration on a card
 * that partially succeeded before) overwrites cleanly instead of
 * erroring on a duplicate path.
 *
 * @param {string|Blob} image - base64 data URL, or a Blob/File
 * @param {string} path - storage path within the bucket, e.g. `${userId}/${cardDefId}.jpg`
 * @returns {Promise<string>} the public URL to store as image_url
 */
export async function uploadImageToStorage(image, path) {
  const blob = typeof image === 'string' ? dataUrlToBlob(image) : image;

  const { error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });

  if (error) throw error;

  return `${storageBaseUrl}/${path}`;
}