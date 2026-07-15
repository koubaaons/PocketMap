/**
 * @fileoverview useBinActions hook.
 * Encapsulates all bin dispatch logic — restore, delete, empty.
 */

// === REFACTOR7d START: Extract useBinActions hook ===

import { useCallback } from 'react';
import { useDispatch, useStore } from './useStore.js';
import { ACTIONS } from '../store/index.js';

export function useBinActions(toast, callbacks = {}) {
  const dispatch = useDispatch();
  const binderSlots  = useStore(s => s.binderSlots ?? []);
  const binderPanels = useStore(s => s.binderPanels ?? []);

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
    // reducer itself uses — since nothing else can change this app's
    // state between this check and the dispatch just below (JS is
    // single-threaded), this always agrees with what the reducer
    // actually does. Matches the corrected reducer logic: the slot/
    // panel was never deleted when the copy was removed, only
    // unlinked (left as a grey placeholder) — the only way it's
    // genuinely gone now is if the user separately removed that
    // placeholder slot manually while this copy sat in Trash. ===
    let restoreMessage = `"${item.name ?? item.cardName}" restored`;
    if (item._type === 'inventoryItem' && item.hadPlacementRemoved) {
      const slotStillExists  = item._unlinkedSlotId  && binderSlots.some(s => s.id === item._unlinkedSlotId);
      const panelStillExists = item._unlinkedPanelId && binderPanels.some(p => p.id === item._unlinkedPanelId);
      restoreMessage = (slotStillExists || panelStillExists)
        ? `"${item.cardName}" restored to its binder`
        : `"${item.cardName}" restored, but its old binder slot was removed while it was in Trash`;
    }

    dispatch({ type: action, payload: { itemId: item.id } });
    toast(restoreMessage);
    callbacks.onRestoreSuccess?.();
  }, [dispatch, toast, callbacks.onRestoreSuccess, binderSlots, binderPanels]);

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