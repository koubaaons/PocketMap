/**
 * @fileoverview useBinderInsertActions hook.
 *
 * Dispatch logic for the Michi Method image library — batch upload
 * (requested directly: "add in a batch like multiselect, not one at a
 * time") and soft-delete (moves to Trash first, matching every other
 * deletable entity in this app, instead of destroying the image
 * immediately).
 */

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createBinderInsert } from '../types/index.js';
import { compressImage } from '../utils/imageCompression.js';
import { uploadImageToStorage, dataUrlToBlob } from '../utils/supabaseImageUpload.js';
import { checkStorageQuota, formatBytes, STORAGE_QUOTA_BYTES } from '../services/userPreferences.js';

export function useBinderInsertActions(toast, userId) {
  const dispatch = useDispatch();

  /**
   * Uploads and adds several images to the library in one batch.
   * @param {FileList|File[]} files
   */
  const handleBulkAddInserts = useCallback(async (files) => {
    const fileArray = Array.from(files ?? []);
    if (fileArray.length === 0) return;

    const inserts = [];
    const failedNames = [];
    let quotaExceeded = false;

    // Sequential, not parallel — same reasoning as
    // CARD_DEFINITION_BULK_ADD's own upload/sync path: a burst of
    // simultaneous uploads is exactly the kind of load that can
    // silently drop some of them. Also what makes checking the quota
    // per-file correct here: each check reads the account's current
    // running total, which the previous file's successful upload has
    // already updated by the time the next one is checked.
    for (const file of fileArray) {
      // Once the quota is hit, every remaining file in this batch
      // would also be rejected — skip straight to failedNames for the
      // rest instead of running a doomed compress+check for each one.
      if (quotaExceeded) { failedNames.push(file.name); continue; }

      try {
        const compressed = await compressImage(file);
        // === CHANGED: compressImage resolves to a base64 data URL
        // string, not a Blob — compressed.size was always undefined,
        // silently making the quota check below always compute
        // NaN <= STORAGE_QUOTA_BYTES (always false in JS), rejecting
        // every single upload regardless of actual usage. Converting
        // to a real Blob here, via the same dataUrlToBlob utility
        // uploadImageToStorage already used internally, fixes the
        // size check and lets that same blob be reused for the
        // upload itself instead of converting twice.
        const imageBlob = dataUrlToBlob(compressed);

        const { allowed, used } = await checkStorageQuota(userId, imageBlob.size);
        if (!allowed) {
          quotaExceeded = true;
          failedNames.push(file.name);
          toast(`Storage limit reached (${formatBytes(used)} / ${formatBytes(STORAGE_QUOTA_BYTES)} used) — stopped after uploading ${inserts.length} of ${fileArray.length}.`, 'error');
          continue;
        }

        const path = `${userId}/inserts/${crypto.randomUUID()}.jpg`;
        const image_url = await uploadImageToStorage(imageBlob, path);
        const { insert, errors } = createBinderInsert({
          name: file.name.replace(/\.[^.]+$/, '') || 'Insert',
          image_url,
          userId,
          image_size_bytes: imageBlob.size,
        });
        if (insert) inserts.push(insert);
        else { failedNames.push(file.name); console.error('[Pinder] insert creation failed:', errors); }
      } catch (err) {
        failedNames.push(file.name);
        console.error('[Pinder] insert upload failed:', file.name, err);
      }
    }

    if (inserts.length > 0) {
      dispatch({ type: ACTIONS.BINDER_INSERT_BULK_ADD, payload: inserts });
    }
    // The quota-exceeded case already toasted its own, more specific
    // message above — this generic failure toast is only for actual
    // upload/creation failures, so the two don't stack confusingly.
    if (failedNames.length > 0 && !quotaExceeded) {
      toast(`${failedNames.length} image${failedNames.length !== 1 ? 's' : ''} failed to upload`, 'error');
    }
    if (inserts.length > 0) {
      toast(`Added ${inserts.length} image${inserts.length !== 1 ? 's' : ''} to the library`);
    }
  }, [dispatch, toast, userId]);

  /**
   * Soft-deletes a library image — moves it to Trash, restorable
   * later. Any combined panel using it goes blank (not removed).
   */
  const handleDeleteInsert = useCallback((insertId) => {
    dispatch({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId } });
    toast('Image moved to trash');
  }, [dispatch, toast]);

  /**
   * Soft-deletes several images at once.
   */
  const handleBulkDeleteInserts = useCallback((insertIds) => {
    insertIds.forEach(insertId => dispatch({ type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId } }));
    toast(`${insertIds.length} image${insertIds.length !== 1 ? 's' : ''} moved to trash`);
  }, [dispatch, toast]);

  return { handleBulkAddInserts, handleDeleteInsert, handleBulkDeleteInserts };
}
