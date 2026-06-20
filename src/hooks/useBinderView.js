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
 *
 * === FIX: swap-target stale-reference bug ===
 *   previewMoveSlot used to re-derive "what's currently at the
 *   destination" by re-searching pageNumber/slotIndex AFTER the click
 *   already happened, using coordinates read from whatever slot object
 *   the click handler's closure happened to be holding. If that closure
 *   was even one render behind (e.g. clicking quickly right after a
 *   previous swap, before the new positions had fully re-rendered into
 *   fresh onClick handlers), the destination coordinates were stale —
 *   pointing at a position that USED TO be occupied by the card you
 *   meant to swap with, but had since moved elsewhere. The function would
 *   then "swap" with whatever card now sat at that stale position
 *   instead, silently shuffling an extra card the user never clicked.
 *
 *   Fix: previewMoveSlot now takes the target slot's id directly (or
 *   null for an empty destination), passed by the caller at the moment
 *   of the actual click — no re-deriving anything by position after the
 *   fact. An id is a stable identity; a position is a snapshot that can
 *   go stale between render and click.
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

  const previewMoveSlot = useCallback((movingSlotId, targetSlotId, pageNumber, slotIndex) => {
    setPreviewSlots(prev => {
      if (!prev) return prev;

      const moving = prev.find(s => s.id === movingSlotId);
      if (!moving) return prev;

      if (targetSlotId) {
        // Swap — both sides resolved by id, not by re-searching position.
        const target = prev.find(s => s.id === targetSlotId);
        if (!target) return prev;

        return prev.map(s => {
          if (s.id === movingSlotId) return { ...s, pageNumber, slotIndex };
          if (s.id === targetSlotId) return { ...s, pageNumber: moving.pageNumber, slotIndex: moving.slotIndex };
          return s;
        });
      }

      // Move to an empty slot — no swap partner.
      return prev.map(s => s.id === movingSlotId ? { ...s, pageNumber, slotIndex } : s);
    });
    setSelectedSlot(null);
  }, []);

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