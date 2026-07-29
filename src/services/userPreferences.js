/**
 * @fileoverview userPreferences — reads/writes the user_preferences
 * table backing the Seed Loader (#135), new-set check (#134), and the
 * existing-collection update check. Also home to the storage quota
 * functions, though those no longer read/write user_preferences at
 * all — see the comment on checkStorageQuota below for why.
 *
 * Deliberately separate from the main store/reducer/sync pattern,
 * the same way useAuth.js talks to Supabase directly rather than
 * going through a dispatched action — this is small, account-level
 * metadata (has this account been seeded yet? when did it last check
 * for new sets?), not part of the app's core binder/collection/card
 * data that needs undo-friendly reducer semantics or offline-first
 * localStorage fallback.
 *
 * A brand-new account has no row in this table at all — nothing
 * creates one at signup. getUserPreferences returns sensible defaults
 * when no row exists yet; the update functions below upsert, creating
 * the row lazily on whichever feature runs first for that account.
 */

import { supabase } from './supabase.js';

// 10MB per account, applied only to PRIVATE uploads (custom card
// images, binder cover stickers, library inserts) — deliberately not
// shared card art (imported via a TCG provider), which is deduplicated
// once across every user and doesn't scale with account count the way
// private uploads do.
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;

const DEFAULTS = Object.freeze({
  seededStarterCollection: false,
  lastNewSetCheckAt: null,
  knownSetIds: [],
  lastCollectionUpdateCheckAt: null,
});

/**
 * @param {string} userId
 * @returns {Promise<{ seededStarterCollection: boolean, lastNewSetCheckAt: string|null, knownSetIds: string[], lastCollectionUpdateCheckAt: string|null }>}
 */
export async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('seeded_starter_collection, last_new_set_check_at, known_set_ids, last_collection_update_check_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[userPreferences] fetch failed:', error);
    return { ...DEFAULTS };
  }
  if (!data) return { ...DEFAULTS }; // no row yet — brand new account

  return {
    seededStarterCollection: data.seeded_starter_collection,
    lastNewSetCheckAt: data.last_new_set_check_at,
    knownSetIds: data.known_set_ids ?? [],
    lastCollectionUpdateCheckAt: data.last_collection_update_check_at,
  };
}

/**
 * Marks the starter collection as seeded — called once, right after
 * the Seed Loader successfully creates the starter collection, so it
 * never runs again for this account (even across devices, even if
 * the user later deletes that collection).
 */
export async function markStarterCollectionSeeded(userId) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, seeded_starter_collection: true }, { onConflict: 'user_id' });
  if (error) console.error('[userPreferences] marking starter collection seeded failed:', error);
}

/**
 * Records that a new-set check just ran, and which set ids are now
 * known — called after every check, whether or not it actually found
 * anything new, so last_new_set_check_at correctly reflects "we just
 * looked", capping checks to once per day regardless of outcome.
 */
export async function recordNewSetCheck(userId, knownSetIds) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, last_new_set_check_at: new Date().toISOString(), known_set_ids: knownSetIds },
      { onConflict: 'user_id' }
    );
  if (error) console.error('[userPreferences] recording new-set check failed:', error);
}

/**
 * Records that an existing-collection update check just ran — called
 * after every check, whether or not it found anything new, capping
 * checks to once per day regardless of outcome. Kept as a separate
 * timestamp from recordNewSetCheck's, since these check two different
 * questions ("does a new set exist?" vs. "did an already-imported set
 * change?") — sharing one timestamp would let whichever check runs
 * first block the other from running the same day.
 */
export async function recordCollectionUpdateCheck(userId) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, last_collection_update_check_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) console.error('[userPreferences] recording collection-update check failed:', error);
}

/**
 * Checks whether uploading a file of the given size would push this
 * account over its storage quota, WITHOUT uploading anything —
 * callers check this before compressing/uploading, and only proceed
 * if allowed is true. Only ever applies to private uploads (custom
 * card images, stickers, inserts); shared card art never counts
 * against this at all, so isn't checked here.
 *
 * === CHANGED: no longer reads a maintained counter at all ===
 * The original design tracked usage via a running total
 * (user_preferences.storage_bytes_used), incremented and decremented
 * across every upload and delete path. Three separate bugs were found
 * in that approach in quick succession — each one a genuinely
 * different missed decrement call (Empty All, replacing a cover
 * sticker), which isn't a coincidence of carelessness so much as the
 * fundamental fragility of maintaining state via scattered writes:
 * any single missed call anywhere causes permanent, silent drift with
 * no way to self-correct short of manually resetting the number.
 *
 * This now calls get_storage_usage (migration 0022), a Postgres
 * function that sums image_size_bytes directly from the actual
 * current data every time it's called — custom card images, library
 * inserts, and sticker JSON. There's no counter to drift, because
 * there's no counter: once an item is genuinely deleted, its row is
 * simply gone, and it automatically stops counting. No decrement call
 * needed anywhere, ever, which eliminates this entire class of bug
 * rather than just the specific instances already found.
 *
 * @returns {Promise<{ allowed: boolean, used: number, remaining: number }>}
 */
export async function checkStorageQuota(userId, additionalBytes) {
  const { data, error } = await supabase.rpc('get_storage_usage', { p_user_id: userId });
  const used = error ? 0 : (data ?? 0);
  if (error) console.error('[userPreferences] fetching storage usage failed:', error);

  return {
    allowed: used + additionalBytes <= STORAGE_QUOTA_BYTES,
    used,
    remaining: Math.max(STORAGE_QUOTA_BYTES - used, 0),
  };
}

/**
 * Formats a byte count as a short, human-readable string (e.g. "1.2 MB")
 * for quota messages and the admin usage view.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fetches every account's real-time storage usage, via
 * get_all_users_storage_usage (migration 0022) — a security-definer
 * Postgres function that checks the caller's email matches the
 * account owner INSIDE the function itself (necessary since
 * aggregating across every user's rows requires bypassing RLS,
 * unlike the per-user function above). Returns an authorization error
 * for anyone else, same as if this were never called at all.
 *
 * Deliberately doesn't include email addresses — auth.users isn't
 * directly queryable from client code at all, so this returns user_id
 * only. Cross-reference a specific id against Supabase's own Auth
 * dashboard (Authentication → Users) to see who it belongs to.
 *
 * @returns {Promise<{ userId: string, storageBytesUsed: number }[]>}
 */
export async function getAllUsersStorageUsage() {
  const { data, error } = await supabase.rpc('get_all_users_storage_usage');

  if (error) {
    console.error('[userPreferences] fetching all users\' storage usage failed:', error);
    return [];
  }
  return (data ?? []).map(row => ({ userId: row.user_id, storageBytesUsed: row.storage_bytes_used ?? 0 }));
}
