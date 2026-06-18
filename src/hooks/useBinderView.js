/**
 * @fileoverview useBinderView hook.
 *
 * page = spread index (0-based):
 *   0 = cover spread (cover + page 1)
 *   1 = pages 2-3
 *   2 = pages 4-5
 *
 * Preview mode:
 *   - Local copy of binderSlots — moves happen here only
 *   - Store untouched until "Save Layout" is pressed
 *   - Exit without saving discards all preview changes
 */

import { useState, useCallback } from 'react';

export function useBinderView(binder, binderSlots) {
  const [page, setPage]                     = useState(0);
  const [addingToSlot, setAddingToSlot]     = useState(null);
  const [activeSlot, setActiveSlot]         = useState(null);
  const [viewingCardDef, setViewingCardDef] = useState(null);

  // === ISSUE #82: preview mode with local slot state ===
  const [isPreviewMode, setIsPreviewMode]   = useState(false);
  const [previewSlots, setPreviewSlots]     = useState(null); // null = not in preview
  const [selectedSlot, setSelectedSlot]     = useState(null);

  const totalSpreads = Math.ceil(binder.pages / 2) + 1;
  const safePage = Math.min(page, totalSpreads - 1);

  // The slots to render — preview slots when in preview, real slots otherwise
  const activeSlots = isPreviewMode ? (previewSlots ?? binderSlots) : binderSlots;

  const openAddToSlot  = (slotIndex, pageNumber) => setAddingToSlot({ slotIndex, pageNumber });
  const closeAddToSlot = () => setAddingToSlot(null);

  const openSlotAction  = (slot, cardDef) => setActiveSlot({ slot, cardDef });
  const closeSlotAction = () => setActiveSlot(null);

  const openCardDetail  = (cardDef) => { setViewingCardDef(cardDef); setActiveSlot(null); };
  const closeCardDetail = () => setViewingCardDef(null);

  const goToPage = (n) => setPage(Math.max(0, Math.min(totalSpreads - 1, n)));

  // Enter preview — copy current slots to local state
  const enterPreviewMode = useCallback(() => {
    setPreviewSlots([...binderSlots]);
    setIsPreviewMode(true);
    setSelectedSlot(null);
  }, [binderSlots]);

  // Exit preview without saving — discard local state
  const exitPreviewMode = useCallback(() => {
    setIsPreviewMode(false);
    setPreviewSlots(null);
    setSelectedSlot(null);
  }, []);

  // Move a slot in preview local state only
  const previewMoveSlot = useCallback((slotId, pageNumber, slotIndex) => {
    setPreviewSlots(prev => {
      if (!prev) return prev;
      // Check target not occupied
      const target = prev.find(s => s.binderId === binder.id && s.pageNumber === pageNumber && s.slotIndex === slotIndex);
      if (target) {
        // Swap the two slots
        return prev.map(s => {
          if (s.id === slotId) return { ...s, pageNumber, slotIndex };
          if (s.id === target.id) {
            const moving = prev.find(x => x.id === slotId);
            return { ...s, pageNumber: moving.pageNumber, slotIndex: moving.slotIndex };
          }
          return s;
        });
      }
      // Move to empty slot
      return prev.map(s => s.id === slotId ? { ...s, pageNumber, slotIndex } : s);
    });
    setSelectedSlot(null);
  }, [binder.id]);

  // Add a card in preview mode — adds to local preview slots
  const previewAddSlot = useCallback((newSlot) => {
    setPreviewSlots(prev => prev ? [...prev, newSlot] : [newSlot]);
  }, []);

  const selectSlotForMove = (slot) => setSelectedSlot(slot);
  const clearSelectedSlot = () => setSelectedSlot(null);

  return {
    page: safePage,
    addingToSlot,
    activeSlot,
    viewingCardDef,
    isPreviewMode,
    previewSlots,
    activeSlots,
    selectedSlot,

    openAddToSlot,
    closeAddToSlot,
    openSlotAction,
    closeSlotAction,
    openCardDetail,
    closeCardDetail,

    goToPage,

    enterPreviewMode,
    exitPreviewMode,
    previewMoveSlot,
    previewAddSlot,
    selectSlotForMove,
    clearSelectedSlot,
  };
}