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
import { uploadImageToStorage } from '../utils/supabaseImageUpload.js';

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

    // Sequential, not parallel — same reasoning as
    // CARD_DEFINITION_BULK_ADD's own upload/sync path: a burst of
    // simultaneous uploads is exactly the kind of load that can
    // silently drop some of them.
    for (const file of fileArray) {
      try {
        const compressed = await compressImage(file);
        const path = `${userId}/inserts/${crypto.randomUUID()}.jpg`;
        const image_url = await uploadImageToStorage(compressed, path);
        const { insert, errors } = createBinderInsert({
          name: file.name.replace(/\.[^.]+$/, '') || 'Insert',
          image_url,
          userId,
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
    if (failedNames.length > 0) {
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