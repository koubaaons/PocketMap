/**
 * @fileoverview One-time backfill: real file sizes for pre-existing
 * uploads.
 *
 * image_size_bytes (added in migration 0021) only started getting
 * populated once the storage quota feature shipped — every card,
 * insert, and sticker uploaded before that point has it as NULL, with
 * nothing to retroactively fill it in. Since the quota (and the admin
 * usage view) now sum this field directly from the actual data
 * (migration 0022), those older uploads were silently invisible to
 * it — not incorrect exactly, just genuinely missing information,
 * which looked like "0 bytes used" even for an account with real
 * existing uploads.
 *
 * This asks Supabase Storage itself — which already knows every
 * file's real size, since it's the actual source of truth for what's
 * stored — for the size of each existing file, and fills in
 * image_size_bytes wherever it's currently missing. Idempotent and
 * safe to run repeatedly: it only ever touches rows/stickers that are
 * still missing a size, so a second run finds nothing left to do.
 *
 * Run once per device via runImageSizeBackfillIfNeeded, gated behind
 * a backfilled_image_sizes_v1 localStorage flag — see useAuth.js for
 * where this gets called, same pattern as the existing base64 image
 * migration.
 */

import { supabase } from '../services/supabase.js';
import { getStoragePathFromUrl, CARD_IMAGES_BUCKET } from './supabaseImageUpload.js';

const BACKFILL_FLAG_KEY = 'backfilled_image_sizes_v1';

/**
 * Runs the backfill once per device for the given user, if it hasn't
 * already run successfully. Safe to call on every login — the
 * localStorage flag makes every call after the first a no-op.
 */
export async function runImageSizeBackfillIfNeeded(userId) {
  if (!userId) return;
  if (localStorage.getItem(BACKFILL_FLAG_KEY) === 'true') return;

  try {
    await backfillImageSizes(userId);
    localStorage.setItem(BACKFILL_FLAG_KEY, 'true');
  } catch (err) {
    // Deliberately NOT setting the flag on failure — a partial or
    // failed run should be retried on the next login rather than
    // silently accepted as "done". Rows already backfilled before the
    // failure are unaffected next time: their image_size_bytes is no
    // longer null, so the queries below simply won't select them
    // again.
    console.error('[Pinder] Image size backfill failed, will retry next login:', err);
  }
}

/**
 * Builds a { filename: sizeInBytes } map for every file directly
 * inside the given Storage folder. Not recursive — matches how each
 * upload path used here is only ever one folder deep from the
 * caller's chosen root (userId/, userId/inserts/, userId/stickers/).
 */
async function listFolderSizes(folderPath) {
  const { data, error } = await supabase.storage.from(CARD_IMAGES_BUCKET).list(folderPath);
  if (error) { console.error(`[Pinder] Failed to list Storage folder "${folderPath}":`, error); return {}; }

  const sizes = {};
  for (const file of data ?? []) {
    if (file.metadata?.size != null) sizes[file.name] = file.metadata.size;
  }
  return sizes;
}

/**
 * Looks up a public image URL's size from an already-fetched
 * { filename: size } map, using getStoragePathFromUrl to extract the
 * exact filename Storage would know it by. Returns null if the URL
 * isn't a private upload at all (e.g. shared/API-imported card art,
 * which has no per-user size to backfill in the first place) or the
 * file genuinely isn't in the map for some other reason.
 */
function lookupSize(imageUrl, sizeMap) {
  const path = getStoragePathFromUrl(imageUrl);
  if (!path) return null;
  const filename = path.split('/').pop();
  return sizeMap[filename] ?? null;
}

/**
 * Finds every card definition, binder insert, and sticker belonging
 * to userId that's missing a recorded image size, looks up its real
 * size directly from Storage, and fills it in.
 */
export async function backfillImageSizes(userId) {
  const [cardSizes, insertSizes, stickerSizes] = await Promise.all([
    listFolderSizes(userId),
    listFolderSizes(`${userId}/inserts`),
    listFolderSizes(`${userId}/stickers`),
  ]);

  let failureCount = 0;

  // === Custom card images ===
  const { data: cardRows, error: cardError } = await supabase
    .from('card_definitions')
    .select('id, image_url')
    .eq('user_id', userId)
    .is('image_size_bytes', null)
    .not('image_url', 'is', null);
  if (cardError) throw cardError;

  for (const row of cardRows ?? []) {
    const size = lookupSize(row.image_url, cardSizes);
    if (size == null) continue; // not a private upload, or genuinely not found — nothing to backfill
    const { error } = await supabase.from('card_definitions').update({ image_size_bytes: size }).eq('id', row.id);
    if (error) { console.error(`[Pinder] Failed to backfill size for card ${row.id}:`, error); failureCount++; }
  }

  // === Library inserts ===
  const { data: insertRows, error: insertError } = await supabase
    .from('binder_inserts')
    .select('id, image_url')
    .eq('user_id', userId)
    .is('image_size_bytes', null);
  if (insertError) throw insertError;

  for (const row of insertRows ?? []) {
    const size = lookupSize(row.image_url, insertSizes);
    if (size == null) continue;
    const { error } = await supabase.from('binder_inserts').update({ image_size_bytes: size }).eq('id', row.id);
    if (error) { console.error(`[Pinder] Failed to backfill size for insert ${row.id}:`, error); failureCount++; }
    // No local dispatch here — binder inserts aren't kept in the main
    // client-side store the way card definitions are (see
    // useBinderInsertActions.js), so there's no local state to update
    // beyond what the database now has.
  }

  // === Binder cover stickers (stored as JSONB on each binder, not
  // their own table — patched in place, whole array at a time) ===
  const { data: binderRows, error: binderError } = await supabase
    .from('binders')
    .select('id, stickers')
    .eq('user_id', userId);
  if (binderError) throw binderError;

  for (const binder of binderRows ?? []) {
    const stickers = binder.stickers ?? [];
    let changed = false;
    const updatedStickers = stickers.map(sticker => {
      if (sticker.imageSizeBytes != null) return sticker;
      const size = lookupSize(sticker.image_url, stickerSizes);
      if (size == null) return sticker;
      changed = true;
      return { ...sticker, imageSizeBytes: size };
    });

    if (!changed) continue;
    const { error } = await supabase.from('binders').update({ stickers: updatedStickers }).eq('id', binder.id);
    if (error) { console.error(`[Pinder] Failed to backfill sticker size(s) for binder ${binder.id}:`, error); failureCount++; }
  }

  if (failureCount > 0) {
    // Same reasoning as migrateBase64CardImages: throwing here means
    // runImageSizeBackfillIfNeeded's catch block does NOT set the
    // "done" flag, so a partial run gets retried next login instead
    // of silently accepted as complete.
    throw new Error(`[Pinder] Image size backfill finished with ${failureCount} failed row(s)`);
  }
}
