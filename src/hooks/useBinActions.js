/**
 * @fileoverview useBinActions hook.
 * Encapsulates all bin dispatch logic — restore, delete, empty.
 */

// === REFACTOR7d START: Extract useBinActions hook ===

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';

export function useBinActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  const handleRestore = useCallback((item) => {
    const typeToAction = {
      binder:     ACTIONS.BIN_RESTORE_BINDER,
      collection: ACTIONS.BIN_RESTORE_COLLECTION,
      cardDef:    ACTIONS.BIN_RESTORE_CARD,
      insert:     ACTIONS.BIN_RESTORE_INSERT,
    };
    const action = typeToAction[item._type];
    if (!action) return;
    dispatch({ type: action, payload: { itemId: item.id } });
    toast(`"${item.name}" restored`);
    callbacks.onRestoreSuccess?.();
  }, [dispatch, toast, callbacks]);

  const handlePermDelete = useCallback((item) => {
    dispatch({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: item.id } });
    toast('Deleted permanently');
    callbacks.onDeleteSuccess?.();
  }, [dispatch, toast, callbacks]);

  const handleEmptyAll = useCallback((onSuccess) => {
    dispatch({ type: ACTIONS.BIN_EMPTY });
    toast('Trash emptied');
    onSuccess?.();
  }, [dispatch, toast]);

  return { handleRestore, handlePermDelete, handleEmptyAll };
}

// === REFACTOR7d END ===