/**
 * @fileoverview userPreferences — reads/writes the user_preferences
 * table backing the Seed Loader (#135) and new-set check (#134).
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
 * when no row exists yet; the two update functions below upsert,
 * creating the row lazily on whichever of the two features runs
 * first for that account.
 */

import { supabase } from './supabase.js';

const DEFAULTS = Object.freeze({
  seededStarterCollection: false,
  lastNewSetCheckAt: null,
  knownSetIds: [],
});

/**
 * @param {string} userId
 * @returns {Promise<{ seededStarterCollection: boolean, lastNewSetCheckAt: string|null, knownSetIds: string[] }>}
 */
export async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('seeded_starter_collection, last_new_set_check_at, known_set_ids')
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
