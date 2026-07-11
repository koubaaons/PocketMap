/**
 * @fileoverview useBinderSlotActions hook.
 * Encapsulates all binder slot dispatch logic.
 */

// === ISSUE #54 START: Add Card to Binder — useBinderSlotActions ===

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createBinderSlot } from '../types/index.js';

export function useBinderSlotActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  /**
   * Places a card into a binder slot.
   */
  const handleAddToSlot = useCallback(({
    binderId, cardDefId, collectionId, pageNumber, slotIndex,
  }) => {
    const { slot, errors } = createBinderSlot({
      binderId, cardDefId, collectionId, pageNumber, slotIndex,
    });
    if (!slot) {
      console.error('[BinderVault] Failed to create binder slot:', errors);
      toast('Failed to add card to binder', 'error');
      return;
    }
    dispatch({ type: ACTIONS.BINDER_SLOT_ADD, payload: { slot } });
    toast(`Added to page ${pageNumber}, slot ${slotIndex + 1}`);
    callbacks.onAddSuccess?.();
  }, [dispatch, toast, callbacks.onAddSuccess]);

  /**
   * Removes a card from a binder slot.
   */
  const handleRemoveFromSlot = useCallback((slotId) => {
    dispatch({ type: ACTIONS.BINDER_SLOT_REMOVE, payload: { slotId } });
    toast('Card removed from binder');
    callbacks.onRemoveSuccess?.();
  }, [dispatch, toast, callbacks.onRemoveSuccess]);

  /**
   * Moves a card to a different page/slot in the same binder.
   */
  const handleMoveSlot = useCallback(({ slotId, pageNumber, slotIndex }) => {
    dispatch({ type: ACTIONS.BINDER_SLOT_MOVE, payload: { slotId, pageNumber, slotIndex } });
    toast('Card moved');
    callbacks.onMoveSuccess?.();
  }, [dispatch, toast, callbacks.onMoveSuccess]);

  /**
   * Adds a page to a binder.
   */
  const handleAddPage = useCallback((binderId) => {
    dispatch({ type: ACTIONS.BINDER_ADD_PAGE, payload: { binderId } });
    toast('Page added');
  }, [dispatch, toast]);

  return { handleAddToSlot, handleRemoveFromSlot, handleMoveSlot, handleAddPage };
}

// === ISSUE #54 END: Add Card to Binder ===