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

const STICKER_MAX_WIDTH = 400;
const MAX_STICKERS = 10;

/**
 * @param {{ binder: object, toast: function }} options
 */
export function useBinderCoverEditor({ binder, toast }) {
  const dispatch = useDispatch();

  const [isEditingCover, setIsEditingCover]     = useState(false);
  const [draftStickers, setDraftStickers]        = useState(binder.stickers ?? []);
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [stickerUploadError, setStickerUploadError] = useState('');
  const [draftName, setDraftName]   = useState(binder.name);
  const [draftColor, setDraftColor] = useState(binder.cover_color);

  const coverRef            = useRef(null);
  const stickerFileInputRef = useRef(null);
  const isUploadingStickerRef = useRef(false);

  const handleEnterCoverEdit = () => {
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setDraftName(binder.name);
    setDraftColor(binder.cover_color);
    setIsEditingCover(true);
  };

  const handleCancelCoverEdit = () => {
    setDraftStickers(binder.stickers ?? []);
    setSelectedStickerId(null);
    setDraftName(binder.name);
    setDraftColor(binder.cover_color);
    setIsEditingCover(false);
  };

  const handleSaveCoverEdit = () => {
    dispatch({
      type: ACTIONS.BINDER_UPDATE,
      payload: { ...binder, stickers: draftStickers, name: draftName.trim() || binder.name, cover_color: draftColor, updatedAt: Date.now() },
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
      const image_url = await compressStickerImage(file, STICKER_MAX_WIDTH);
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
    } catch (err) {
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
    setSelectedStickerId,
    setDraftName,
    setDraftColor,
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