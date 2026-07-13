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
 * Converts a public URL (as returned by uploadImageToStorage) back into
 * its storage path, so it can be passed to Storage's remove(). Returns
 * null if the URL doesn't match this bucket's base URL at all (e.g. an
 * external image someone pasted in some other way) — callers should
 * skip deletion rather than attempt to remove something that was never
 * actually in this bucket to begin with.
 */
export function getStoragePathFromUrl(url) {
  if (!url || !url.startsWith(storageBaseUrl)) return null;
  return url.slice(storageBaseUrl.length + 1); // +1 for the joining '/'
}

/**
 * Deletes a single object from the card-images bucket by its storage
 * path. Safe to call with a null path (no-ops) — callers don't need to
 * separately guard every call site with their own null check.
 */
export async function deleteImageFromStorage(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(CARD_IMAGES_BUCKET).remove([path]);
  if (error) console.error('[Pinder] Failed to delete storage object:', path, error);
}

/**
 * Checks whether a file already exists at the given path in the
 * bucket, without downloading it — used to skip re-uploading an
 * image that's already there (see uploadSharedImageIfMissing below).
 */
async function fileExistsAtPath(path) {
  const lastSlash = path.lastIndexOf('/');
  const folder = lastSlash === -1 ? '' : path.slice(0, lastSlash);
  const filename = lastSlash === -1 ? path : path.slice(lastSlash + 1);
  const { data, error } = await supabase.storage
    .from(CARD_IMAGES_BUCKET)
    .list(folder, { search: filename });
  if (error) return false; // fail open — treat as "doesn't exist", upload will just upsert
  return (data ?? []).some(f => f.name === filename);
}

/**
 * For images that are the SAME for every user — official card art
 * from an API import, not a personal photo or sticker — this stores
 * one shared copy instead of one copy per user who happens to import
 * the same card. If the path already has a file (a previous user
 * already imported this exact card), skips fetching the source image
 * AND uploading entirely, just returns the existing public URL —
 * getImage is a lazy function, not a pre-fetched blob, specifically
 * so the (often slow, external-CDN) fetch only happens when actually
 * needed. Only ever call this for genuinely shared, official artwork;
 * user-uploaded photos and stickers must keep using
 * uploadImageToStorage with a user-scoped path, since those are NOT
 * the same across users.
 *
 * @param {() => Promise<Blob|string>} getImage - lazily fetches/builds
 *   the image (base64 or Blob) — only called if not already cached
 * @param {string} path
 */
export async function uploadSharedImageIfMissing(getImage, path) {
  const alreadyExists = await fileExistsAtPath(path);
  if (alreadyExists) {
    return `${storageBaseUrl}/${path}`;
  }
  const image = await getImage();
  return uploadImageToStorage(image, path);
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
    .upload(path, blob, {
      contentType: blob.type,
      upsert: true,
      // One year — card images never change once uploaded (a new
      // upload gets a new random path, see CardDefinitionForm.jsx/
      // useBinderCoverEditor.js, rather than overwriting an existing
      // one), so there's no staleness risk in caching this long.
      // Directly reduces egress: the browser only downloads each
      // image once, ever, instead of on every page load.
      cacheControl: '31536000',
    });

  if (error) throw error;

  return `${storageBaseUrl}/${path}`;
}