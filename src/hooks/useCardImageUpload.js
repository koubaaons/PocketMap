/**
 * @fileoverview useCardImageUpload hook.
 *
 * Extracted from CardDefinitionForm.jsx and CardDetailModal.jsx, which
 * both had byte-for-byte identical isCompressing/handleImageChange/
 * handleRemoveImage logic — genuine duplication, not just similar
 * code. The image PREVIEW layout itself still differs structurally
 * between the two (CardDefinitionForm shows a full preview+remove
 * wrapper inline; CardDetailModal's card floats separately from its
 * panel, so only the "add image" placeholder lives here, with the
 * actual preview rendered elsewhere in that component) — this only
 * extracts what's genuinely identical: the upload mechanics.
 */

import { useState, useRef } from 'react';
import { compressImage } from '../utils/index.js';
import { uploadImageToStorage, dataUrlToBlob } from '../utils/supabaseImageUpload.js';
import { checkStorageQuota, formatBytes, STORAGE_QUOTA_BYTES } from '../services/userPreferences.js';
import { useAuth } from './useAuth.js';

/**
 * @param {{ set: (key: string, value: any) => void, toast?: (msg: string, type?: string) => void }} params
 *   set is whatever form-state setter (useCardDefinitionForm's `set`)
 *   should receive the resulting image_url. toast is optional so
 *   existing callers that haven't been updated yet don't break —
 *   without it, a quota rejection still aborts the upload, just
 *   silently (matching this hook's pre-existing error handling, which
 *   only ever logged to the console with no user-facing feedback at
 *   all).
 */
export function useCardImageUpload({ set, toast }) {
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      // === CHANGED: compressImage resolves to a base64 data URL
      // string, not a Blob — compressed.size was always undefined,
      // making the quota check below silently compute
      // NaN <= STORAGE_QUOTA_BYTES (always false in JS), rejecting
      // every single upload regardless of actual usage. Converting to
      // a real Blob here, via the same dataUrlToBlob utility
      // uploadImageToStorage already used internally, fixes the size
      // check and lets that same blob be reused for the upload itself
      // instead of converting twice.
      const imageBlob = dataUrlToBlob(compressed);

      // === Storage quota check — requested directly, applies only to
      // this private, per-user upload (never to shared card art).
      // Checked BEFORE uploading, not after, so a rejected upload
      // never touches Storage at all.
      const { allowed, used } = await checkStorageQuota(user.id, imageBlob.size);
      if (!allowed) {
        toast?.(`Storage limit reached (${formatBytes(used)} / ${formatBytes(STORAGE_QUOTA_BYTES)} used) — delete something to free up space.`, 'error');
        return;
      }

      // Card definitions don't have a real id yet in create mode, so
      // the storage path uses a fresh random id rather than the
      // eventual card def id — nothing downstream depends on the two
      // matching, this just needs to be a unique path in the bucket.
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const publicUrl = await uploadImageToStorage(imageBlob, path);
      set('image_url', publicUrl);
      set('image_size_bytes', imageBlob.size);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    set('image_url', null);
    set('image_size_bytes', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return { isCompressing, fileInputRef, handleImageChange, handleRemoveImage };
}