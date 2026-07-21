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
import { uploadImageToStorage } from '../utils/supabaseImageUpload.js';
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
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setDraftName(binder.name);
    setDraftColor(binder.cover_color);
    setDraftPageColor(binder.page_color);
    setIsPreviewingPageColor(false);
    setIsEditingCover(false);
  };

  const handleSaveCoverEdit = () => {
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
      // === ISSUE #125 (extended to stickers): compressStickerImage
      // still resolves to a base64 PNG locally, but that's uploaded
      // to Storage immediately after — it's the returned public URL,
      // not the base64 itself, that ends up on the sticker object and
      // eventually in binders.stickers (jsonb) in the database.
      // Stored under a stickers/ subfolder in the same card-images
      // bucket, keeping them separate from card images without
      // needing a second bucket.
      const path = `${user.id}/stickers/${crypto.randomUUID()}.png`;
      const image_url = await uploadImageToStorage(compressed, path);
      // Slight random offset around center so multiple stickers don't
      // land exactly on top of each other — still fully draggable
      // anywhere on the cover afterward.
      const offsetX = 50 + (Math.random() * 20 - 10);
      const offsetY = 50 + (Math.random() * 20 - 10);
      const { sticker, errors } = createSticker({ image_url, x: offsetX, y: offsetY, rotation: 0 });
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
    setDraftStickers(prev => prev.filter(s => s.id !== id));
    if (selectedStickerId === id) setSelectedStickerId(null);
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