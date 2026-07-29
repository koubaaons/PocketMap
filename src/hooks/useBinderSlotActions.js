/**
 * @fileoverview useBinderSlotActions hook.
 * Encapsulates all binder slot dispatch logic.
 */

// === ISSUE #54 START: Add Card to Binder — useBinderSlotActions ===

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createBinderSlot, MAX_BINDER_PAGES } from '../types/index.js';

export function useBinderSlotActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  /**
   * Places a card into a binder slot.
   * @param {{chosenCopyId?: string}} params - when the user deliberately
   *   picked a specific copy (e.g. via the Add Card modal's copy
   *   picker), links the new slot to it directly instead of letting
   *   the reducer auto-pick whichever unplaced copy comes first.
   */
  const handleAddToSlot = useCallback(({
    binderId, cardDefId, collectionId, pageNumber, slotIndex, chosenCopyId = null,
  }) => {
    const { slot, errors } = createBinderSlot({
      binderId, cardDefId, collectionId, pageNumber, slotIndex,
      inventoryItemId: chosenCopyId,
    });
    if (!slot) {
      console.error('[Pinder] Failed to create binder slot:', errors);
      toast('Failed to add card to binder', 'error');
      return;
    }
    dispatch({ type: ACTIONS.BINDER_SLOT_ADD, payload: { slot } });
    toast(`Added to page ${pageNumber}, slot ${slotIndex + 1}`);
    callbacks.onAddSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Removes a card from a binder slot.
   */
  const handleRemoveFromSlot = useCallback((slotId) => {
    dispatch({ type: ACTIONS.BINDER_SLOT_REMOVE, payload: { slotId } });
    toast('Card removed from binder');
    callbacks.onRemoveSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Moves a card to a different page/slot in the same binder.
   */
  const handleMoveSlot = useCallback(({ slotId, pageNumber, slotIndex }) => {
    dispatch({ type: ACTIONS.BINDER_SLOT_MOVE, payload: { slotId, pageNumber, slotIndex } });
    toast('Card moved');
    callbacks.onMoveSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Adds a page to a binder.
   */
  const handleAddPage = useCallback((binderId, currentPages) => {
    if (currentPages >= MAX_BINDER_PAGES) {
      toast(`A binder can have at most ${MAX_BINDER_PAGES} pages.`, 'error');
      return;
    }
    dispatch({ type: ACTIONS.BINDER_ADD_PAGE, payload: { binderId } });
    toast('Page added');
  }, [dispatch, toast]);

  /**
   * Swaps everything on page A with everything on page B — cards
   * some users have asked for after seeing it on other card-tracking
   * sites. pageA/pageB are 1-based physical page numbers.
   */
  const handleSwapPages = useCallback((binderId, pageA, pageB) => {
    if (pageA === pageB) {
      toast('Choose two different pages to swap', 'error');
      return;
    }
    dispatch({ type: ACTIONS.BINDER_SWAP_PAGES, payload: { binderId, pageA, pageB } });
    toast(`Swapped page ${pageA} and page ${pageB}`);
  }, [dispatch, toast]);

  return { handleAddToSlot, handleRemoveFromSlot, handleMoveSlot, handleAddPage, handleSwapPages };
}

// === ISSUE #54 END: Add Card to Binder ===