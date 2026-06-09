/**
 * @fileoverview useInventoryActions hook.
 *
 * Encapsulates all inventory dispatch logic:
 * - Mark card as owned (creates inventory entry)
 * - Remove ownership (deletes inventory entry)
 * - Update acquisition info (condition, notes, tradeable, sellable)
 * - Toggle favorite
 */
import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createInventoryItem } from '../types/index.js';

/**
 * @param {(message: string, type?: string) => void} toast
 * @param {{ onOwnSuccess?: () => void, onUnownSuccess?: () => void }} callbacks
 */
export function useInventoryActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  /**
   * Marks a card as owned — creates an inventory entry.
   * @param {{ cardDefId: string, collectionId: string }} params
   */
  const handleOwn = useCallback(({ cardDefId, collectionId }) => {
    const { item, errors } = createInventoryItem({ cardDefId, collectionId });
    if (!item) {
      console.error('[BinderVault] Failed to create inventory item:', errors);
      toast('Failed to mark card as owned', 'error');
      return;
    }
    dispatch({ type: ACTIONS.INVENTORY_ADD, payload: item });
    toast('Card marked as owned');
    callbacks.onOwnSuccess?.();
  }, [dispatch, toast, callbacks.onOwnSuccess]);

  /**
   * Removes ownership — deletes the inventory entry.
   * @param {string} inventoryId
   */
  const handleUnown = useCallback((inventoryId) => {
    dispatch({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId } });
    toast('Ownership removed');
    callbacks.onUnownSuccess?.();
  }, [dispatch, toast, callbacks.onUnownSuccess]);

  // === ISSUE #37 START: Acquisition Information — update handler ===
  /**
   * Updates acquisition information on an owned card.
   * @param {object} updatedItem - partial inventory item with id
   */
  const handleUpdateAcquisition = useCallback((updatedItem) => {
    dispatch({ type: ACTIONS.INVENTORY_UPDATE, payload: updatedItem });
    toast('Card details updated');
  }, [dispatch, toast]);
  // === ISSUE #37 END ===

  return {
    handleOwn,
    handleUnown,
    handleUpdateAcquisition,
    handleToggleFavorite,
  };
}
