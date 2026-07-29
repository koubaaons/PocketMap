/**
 * @fileoverview useBinderCoverEditor — sticker/cover editing state and
 * handlers for BinderView.
 *
 * Extracted from BinderView.jsx where this logic lived inline alongside
 * unrelated concerns (page navigation, fullscreen, slot actions etc).
 *
 * === What this hook owns ===
 * - All sticker draft state (draftStickers, selectedStickerId,
 *   isUploadingSticker, stickerUploadError)
 * - isEditingCover toggle
 * - coverRef / stickerFileInputRef / isUploadingStickerRef
 * - All handlers: enter/cancel/save cover edit, add/change/remove sticker
 *
 * === What it does NOT own ===
 * - isCover (derived from spread in BinderView, passed into BinderCover)
 * - The cover JSX itself (lives in BinderCover.jsx)
 * - binder.cover_color / color (owned by BinderView, passed as prop)
 */

import { useCallback, useRef, useState } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createSticker } from '../types/index.js';
import { compressStickerImage } from '../utils/index.js';
import { uploadImageToStorage, deleteImageFromStorage, getStoragePathFromUrl, dataUrlToBlob } from '../utils/supabaseImageUpload.js';
import { checkStorageQuota, formatBytes, STORAGE_QUOTA_BYTES } from '../services/userPreferences.js';
import { useAuth } from './useAuth.js';

const STICKER_MAX_WIDTH = 400;
const MAX_STICKERS = 1;

/**
 * @param {{ binder: object, toast: function }} options
 */
export function useBinderCoverEditor({ binder, toast }) {
  const dispatch = useDispatch();
  const { user } = useAuth();

  const [isEditingCover, setIsEditingCover]     = useState(false);
  const [draftStickers, setDraftStickers]        = useState(binder.stickers ?? []);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [stickerUploadError, setStickerUploadError] = useState('');
  const [draftName, setDraftName]   = useState(binder.name);
  const [draftColor, setDraftColor] = useState(binder.cover_color);
  const [draftPageColor, setDraftPageColor] = useState(binder.page_color);
  // === Whether the front cover should go transparent to reveal the
  // real first page underneath (already mounted behind it thanks to
  // the binder's own virtualization keeping nearby pairs in the DOM
  // even while closed) — only true while actively interacting with
  // the page-color picker specifically, not for the whole time the
  // panel is open, since the cover also needs to stay opaque the
  // rest of the time to show its OWN live-previewed cover color. ===
  const [isPreviewingPageColor, setIsPreviewingPageColor] = useState(false);

  const coverRef            = useRef(null);
  const stickerFileInputRef = useRef(null);
  const isUploadingStickerRef = useRef(false);

  // === Cleans up any sticker that was uploaded during this draft
  // session but never actually saved — a real, pre-existing bug this
  // fixes: the upload itself always happened for real (a genuine
  // Storage file, consuming genuine space) the moment a sticker was
  // added to the draft, regardless of whether the cover edit was ever
  // saved. Cancelling just discarded the local draft state, silently
  // leaving that file orphaned in Storage forever. Now diffs the
  // draft against the binder's actual saved stickers and deletes
  // anything that was only ever local from Storage — the quota total
  // itself needs no separate update at all, since it's computed
  // fresh from whatever actually exists in Storage/the database each
  // time it's checked (see checkStorageQuota). ===
  const cleanUpUnsavedStickers = (draft) => {
    const savedIds = new Set((binder.stickers ?? []).map(s => s.id));
    const unsaved = draft.filter(s => !savedIds.has(s.id));
    unsaved.forEach(sticker => {
      const path = getStoragePathFromUrl(sticker.image_url);
      if (path) deleteImageFromStorage(path).catch(err => console.error('[useBinderCoverEditor] failed to clean up unsaved sticker:', err));
    });
  };

  const handleEnterCoverEdit = () => {
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setDraftName(binder.name);
    setDraftColor(binder.cover_color);
    setDraftPageColor(binder.page_color);
    setIsPreviewingPageColor(false);
    setIsEditingCover(true);
  };

  const handleCancelCoverEdit = () => {
    cleanUpUnsavedStickers(draftStickers);
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setDraftName(binder.name);
    setDraftColor(binder.cover_color);
    setDraftPageColor(binder.page_color);
    setIsPreviewingPageColor(false);
    setIsEditingCover(false);
  };

  const handleSaveCoverEdit = () => {
    // === Cleans up any sticker that WAS already saved but got
    // dropped during this edit — a real, previously-uncovered gap:
    // since a cover only ever allows one sticker, "replace it" means
    // remove-then-add, and the removed one never went through Trash
    // (only whole binders do), so nothing ever deleted its file at
    // all. Every replace silently orphaned the old sticker's file,
    // with zero cleanup path until now. Deleting the file here is all
    // that's needed — the quota total itself is computed fresh from
    // whatever actually exists each time it's checked, so there's no
    // separate number to update.
    const finalIds = new Set(draftStickers.map(s => s.id));
    const droppedStickers = (binder.stickers ?? []).filter(s => !finalIds.has(s.id));
    droppedStickers.forEach(sticker => {
      const path = getStoragePathFromUrl(sticker.image_url);
      if (path) deleteImageFromStorage(path).catch(err => console.error('[useBinderCoverEditor] failed to clean up replaced sticker:', err));
    });

    dispatch({
      type: ACTIONS.BINDER_UPDATE,
      payload: { ...binder, stickers: draftStickers, name: draftName.trim() || binder.name, cover_color: draftColor, page_color: draftPageColor, updatedAt: Date.now() },
    });
    toast?.('Cover updated');
    setSelectedStickerId(null);
    setIsEditingCover(false);
  };

  const handleAddStickerClick = () => {
    if (draftStickers.length >= MAX_STICKERS) {
      setStickerUploadError(`Maximum ${MAX_STICKERS} stickers per cover.`);
      return;
    }
    stickerFileInputRef.current?.click();
  };

  const handleStickerFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (isUploadingStickerRef.current) return;
    isUploadingStickerRef.current = true;

    setIsUploadingSticker(true);
    setStickerUploadError('');
    try {
      const compressed = await compressStickerImage(file, STICKER_MAX_WIDTH);
      // === CHANGED: compressStickerImage resolves to a base64 data
      // URL string, not a Blob — compressed.size was always
      // undefined, silently making the quota check below always
      // compute NaN <= STORAGE_QUOTA_BYTES (always false in JS),
      // rejecting every single sticker upload regardless of actual
      // usage. Converting to a real Blob here, via the same
      // dataUrlToBlob utility uploadImageToStorage already used
      // internally, fixes the size check and lets that same blob be
      // reused for the upload itself instead of converting twice.
      const imageBlob = dataUrlToBlob(compressed);

      // === Storage quota check — requested directly, applies only to
      // this private, per-user upload (never to shared card art).
      // Checked BEFORE uploading, not after, so a rejected upload
      // never touches Storage at all.
      const { allowed, used } = await checkStorageQuota(user.id, imageBlob.size);
      if (!allowed) {
        setStickerUploadError(`Storage limit reached (${formatBytes(used)} / ${formatBytes(STORAGE_QUOTA_BYTES)} used) — delete something to free up space.`);
        return;
      }

      // === ISSUE #125 (extended to stickers): compressStickerImage
      // still resolves to a base64 PNG locally, but that's uploaded
      // to Storage immediately after — it's the returned public URL,
      // not the base64 itself, that ends up on the sticker object and
      // eventually in binders.stickers (jsonb) in the database.
      // Stored under a stickers/ subfolder in the same card-images
      // bucket, keeping them separate from card images without
      // needing a second bucket.
      const path = `${user.id}/stickers/${crypto.randomUUID()}.png`;
      const image_url = await uploadImageToStorage(imageBlob, path);
      // Slight random offset around center so multiple stickers don't
      // land exactly on top of each other — still fully draggable
      // anywhere on the cover afterward.
      const offsetX = 50 + (Math.random() * 20 - 10);
      const offsetY = 50 + (Math.random() * 20 - 10);
      const { sticker, errors } = createSticker({ image_url, x: offsetX, y: offsetY, rotation: 0, imageSizeBytes: imageBlob.size });
      if (!sticker) {
        setStickerUploadError('Could not add that image — ' + errors.join(', '));
        return;
      }
      setDraftStickers(prev => [...prev, sticker]);
      setSelectedStickerId(sticker.id);
    } catch {
      setStickerUploadError('Could not read that image. Try a different file.');
    } finally {
      setIsUploadingSticker(false);
      isUploadingStickerRef.current = false;
    }
  };

  const handleRemoveDraftSticker = (id) => {
    const removed = draftStickers.find(s => s.id === id);
    setDraftStickers(prev => prev.filter(s => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
    // Only clean up here if this sticker was never actually saved —
    // if it WAS already saved (part of binder.stickers), removing it
    // is still just a draft change at this point; the real Storage
    // cleanup for that case happens through the normal permanent-
    // delete path when the binder itself is eventually deleted, same
    // as any other saved sticker.
    const wasSaved = (binder.stickers ?? []).some(s => s.id === id);
    if (removed && !wasSaved) {
      const path = getStoragePathFromUrl(removed.image_url);
      if (path) deleteImageFromStorage(path).catch(err => console.error('[useBinderCoverEditor] failed to clean up removed sticker:', err));
    }
  };

  const handleChangeDraftSticker = useCallback((id, patch) => {
    setDraftStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  return {
    // refs
    coverRef,
    stickerFileInputRef,
    // state
    isEditingCover,
    draftStickers,
    selectedStickerId,
    isUploadingSticker,
    stickerUploadError,
    draftName,
    draftColor,
    draftPageColor,
    isPreviewingPageColor,
    setSelectedStickerId,
    setDraftName,
    setDraftColor,
    setDraftPageColor,
    setIsPreviewingPageColor,
    // handlers
    handleEnterCoverEdit,
    handleCancelCoverEdit,
    handleSaveCoverEdit,
    handleAddStickerClick,
    handleStickerFileSelected,
    handleChangeDraftSticker,
    handleRemoveDraftSticker,
    // constants needed by BinderCover
    MAX_STICKERS,
  };
}