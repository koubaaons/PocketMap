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
import { uploadImageToStorage } from '../utils/supabaseImageUpload.js';
import { useAuth } from './useAuth.js';

/**
 * @param {{ set: (key: string, value: any) => void }} params
 *   set is whatever form-state setter (useCardDefinitionForm's `set`)
 *   should receive the resulting image_url.
 */
export function useCardImageUpload({ set }) {
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      // Card definitions don't have a real id yet in create mode, so
      // the storage path uses a fresh random id rather than the
      // eventual card def id — nothing downstream depends on the two
      // matching, this just needs to be a unique path in the bucket.
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const publicUrl = await uploadImageToStorage(compressed, path);
      set('image_url', publicUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveImage = () => {
    set('image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return { isCompressing, fileInputRef, handleImageChange, handleRemoveImage };
}