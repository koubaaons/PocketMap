/**
 * @fileoverview useBinderView hook.
 *
 * Encapsulates all state management for BinderView:
 * - Current page
 * - Which slot is being filled (addingToSlot)
 * - Which slot is active/clicked (activeSlot)
 * - Which card def is being viewed in detail
 *
 * No dispatch here — callers handle actions via useBinderSlotActions.
 */

// === REFACTOR7a START: Extract useBinderView hook ===

import { useState } from 'react';

export function useBinderView(binder) {
  const [page, setPage]                     = useState(1);
  const [addingToSlot, setAddingToSlot]     = useState(null);
  const [activeSlot, setActiveSlot]         = useState(null);
  const [viewingCardDef, setViewingCardDef] = useState(null);

  const safePage = Math.min(page, binder.pages);

  const openAddToSlot  = (slotIndex) => setAddingToSlot({ slotIndex });
  const closeAddToSlot = ()          => setAddingToSlot(null);

  const openSlotAction  = (slot, cardDef) => setActiveSlot({ slot, cardDef });
  const closeSlotAction = ()              => setActiveSlot(null);

  const openCardDetail  = (cardDef) => { setViewingCardDef(cardDef); setActiveSlot(null); };
  const closeCardDetail = ()        => setViewingCardDef(null);

  const goToPrevPage = () => setPage(p => Math.max(1, p - 1));
  const goToNextPage = () => setPage(p => Math.min(binder.pages, p + 1));
  const goToPage     = (n) => setPage(n);

  return {
    page: safePage,
    addingToSlot,
    activeSlot,
    viewingCardDef,

    openAddToSlot,
    closeAddToSlot,
    openSlotAction,
    closeSlotAction,
    openCardDetail,
    closeCardDetail,

    goToPrevPage,
    goToNextPage,
    goToPage,
  };
}

// === REFACTOR7a END ===