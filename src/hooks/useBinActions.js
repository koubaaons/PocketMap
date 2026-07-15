/**
 * @fileoverview useBinActions hook.
 * Encapsulates all bin dispatch logic — restore, delete, empty.
 */

// === REFACTOR7d START: Extract useBinActions hook ===

import { useCallback } from 'react';
import { useDispatch, useStore } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { isSlotPositionFree } from '../selectors/binderSelectors.js';

export function useBinActions(toast, callbacks = {}) {
  const dispatch = useDispatch();
  const binders      = useStore(s => s.binders);
  const binderSlots   = useStore(s => s.binderSlots ?? []);
  const binderPanels  = useStore(s => s.binderPanels ?? []);

  const handleRestore = useCallback((item) => {
    const typeToAction = {
      binder:     ACTIONS.BIN_RESTORE_BINDER,
      collection: ACTIONS.BIN_RESTORE_COLLECTION,
      cardDef:    ACTIONS.BIN_RESTORE_CARD,
      inventoryItem: ACTIONS.BIN_RESTORE_INVENTORY_ITEM,
    };
    const action = typeToAction[item._type];
    if (!action) return;

    // === Predicted BEFORE dispatching, using the identical check the
    // reducer itself uses (isSlotPositionFree) — since nothing else
    // can change this app's state between this check and the
    // dispatch just below (JS is single-threaded), this always
    // agrees with what the reducer actually does, without needing to
    // read state back out after an async dispatch. ===
    let restoreMessage = `"${item.name ?? item.cardName}" restored`;
    if (item._type === 'inventoryItem' && item.hadPlacementRemoved) {
      const slot = item._removedSlot;
      const panel = item._removedPanel;
      const target = slot ?? panel;
      const binderStillExists = target && binders.some(b => b.id === target.binderId);
      const positionFree = target && binderStillExists && isSlotPositionFree(
        binderSlots, target.binderId, target.pageNumber, slot ? target.slotIndex : target.startSlotIndex
      );
      restoreMessage = positionFree
        ? `"${item.cardName}" restored to its binder`
        : `"${item.cardName}" restored, but its old binder slot is now taken by a different card`;
    }

    dispatch({ type: action, payload: { itemId: item.id } });
    toast(restoreMessage);
    callbacks.onRestoreSuccess?.();
  }, [dispatch, toast, callbacks.onRestoreSuccess, binders, binderSlots, binderPanels]);

  const handlePermDelete = useCallback((item) => {
    dispatch({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: item.id } });
    toast('Deleted permanently');
    callbacks.onDeleteSuccess?.();
  }, [dispatch, toast, callbacks.onDeleteSuccess]);

  const handleEmptyAll = useCallback((onSuccess) => {
    dispatch({ type: ACTIONS.BIN_EMPTY });
    toast('Trash emptied');
    onSuccess?.();
  }, [dispatch, toast]);

  return { handleRestore, handlePermDelete, handleEmptyAll };
}

// === REFACTOR7d END ===