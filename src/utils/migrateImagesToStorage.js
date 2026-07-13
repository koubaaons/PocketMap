/**
 * @fileoverview One-time migration: base64 card images → Storage URLs.
 * === ISSUE #125: Supabase Storage Migration ===
 *
 * Card images used to be stored as raw base64 data URLs directly in
 * card_definitions.image_url. Every image API in Milestone 13 returns
 * a real URL instead, so any base64 rows left behind would make every
 * future image query inconsistent (two different formats meaning the
 * same thing). This finds every card definition for the current user
 * whose image_url still starts with "data:" (the unambiguous marker
 * of a base64 data URL — a real URL never starts this way), uploads
 * the decoded image to Storage, and rewrites the row to point at the
 * new public URL instead.
 *
 * Run once per device via runImageMigrationIfNeeded, gated behind a
 * migrated_images_v1 localStorage flag — see useAuth.js for where this
 * gets called (on SIGNED_IN).
 */

import { supabase } from '../services/supabase.js';
import { uploadImageToStorage } from './supabaseImageUpload.js';

const MIGRATION_FLAG_KEY = 'migrated_images_v1';

/**
 * Runs the migration once per device for the given user, if it hasn't
 * already run successfully. Safe to call on every login — the
 * localStorage flag makes every call after the first a no-op.
 */
export async function runImageMigrationIfNeeded(userId) {
  if (!userId) return;
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return;

  try {
    await migrateBase64CardImages(userId);
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch (err) {
    // Deliberately NOT setting the flag on failure — a partial or
    // failed run should be retried on the next login rather than
    // silently accepted as "done". Rows already migrated before the
    // failure are unaffected next time: their image_url no longer
    // starts with "data:", so the query below simply won't select
    // them again.
    console.error('[Pinder] Image migration failed, will retry next login:', err);
  }
}

/**
 * Finds every card definition belonging to userId whose image_url is
 * still a base64 data URL, and migrates each one to Storage.
 */
export async function migrateBase64CardImages(userId) {
  const { data: rows, error } = await supabase
    .from('card_definitions')
    .select('id, image_url')
    .eq('user_id', userId)
    .like('image_url', 'data:%');

  if (error) throw error;
  if (!rows || rows.length === 0) return;

  console.log(`[Pinder] Migrating ${rows.length} base64 card image(s) to Storage...`);

  let failureCount = 0;

  for (const row of rows) {
    try {
      const extension = row.image_url.includes('image/png') ? 'png' : 'jpg';
      const path = `${userId}/${row.id}.${extension}`;
      const publicUrl = await uploadImageToStorage(row.image_url, path);

      const { error: updateError } = await supabase
        .from('card_definitions')
        .update({ image_url: publicUrl })
        .eq('id', row.id);

      if (updateError) throw updateError;
    } catch (rowErr) {
      // One bad row shouldn't abort the whole migration for the OTHER
      // rows — log it and keep going, they still get their chance.
      // But this row itself needs to be retried next login, so it
      // counts toward failureCount below rather than being silently
      // treated as done.
      console.error(`[Pinder] Failed to migrate card image for row ${row.id}:`, rowErr);
      failureCount++;
    }
  }

  if (failureCount > 0) {
    // Throwing here means runImageMigrationIfNeeded's catch block
    // does NOT set the migrated_images_v1 flag — without this, a
    // partial run (some rows migrated, some failed) would report
    // "done" and the flag would permanently block retrying the rows
    // that actually failed. Rows that DID succeed above already had
    // their image_url updated in the database, so they won't be
    // re-selected (no longer starts with "data:") next time this runs.
    throw new Error(`[Pinder] Image migration finished with ${failureCount} failed row(s)`);
  }
}