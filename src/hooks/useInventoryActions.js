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
   * @param {{ cardDefId: string, collectionId: string, linkToSlotId?: string }} params
   * linkToSlotId — when marking an unowned placeholder slot as
   * owned (the hover ✓/○ toggle in a binder), links the newly-created
   * copy to that exact slot via BINDER_SLOT_UPDATE. Without this the
   * slot would stay unlinked even though the card now shows as owned
   * somewhere — see BINDER_SLOT_UPDATE's own comment in reducer.js.
   */
  const handleOwn = useCallback(({ cardDefId, collectionId, linkToSlotId }) => {
    const { item, errors } = createInventoryItem({ cardDefId, collectionId });
    if (!item) {
      console.error('[Pinder] Failed to create inventory item:', errors);
      toast('Failed to mark card as owned', 'error');
      return;
    }
    dispatch({ type: ACTIONS.INVENTORY_ADD, payload: item });
    if (linkToSlotId) {
      dispatch({ type: ACTIONS.BINDER_SLOT_UPDATE, payload: { slotId: linkToSlotId, inventoryItemId: item.id } });
    }
    toast('Card marked as owned');
    callbacks.onOwnSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Removes ownership — deletes the inventory entry.
   * @param {string} inventoryId
   */
  const handleUnown = useCallback((inventoryId) => {
    dispatch({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId } });
    toast('Ownership removed');
    callbacks.onUnownSuccess?.();
  }, [dispatch, toast, callbacks]);
  /**
   * Updates acquisition information on an owned card.
   * @param {object} updatedItem - partial inventory item with id
   */
  const handleUpdateAcquisition = useCallback((updatedItem) => {
    dispatch({ type: ACTIONS.INVENTORY_UPDATE, payload: updatedItem });
    toast('Card details updated');
  }, [dispatch, toast]);

  // === ISSUE #38 START: Favorite Cards — toggle favorite ===
  /**
   * Toggles the is_favorite flag on an inventory item.
   * @param {object} inventoryItem
   */
  const handleToggleFavorite = useCallback((inventoryItem) => {
    dispatch({
      type: ACTIONS.INVENTORY_UPDATE,
      payload: { ...inventoryItem, is_favorite: !inventoryItem.is_favorite },
    });
    toast(inventoryItem.is_favorite ? 'Removed from favorites' : 'Added to favorites');
  }, [dispatch, toast]);
  // === ISSUE #38 END ===

  return {
    handleOwn,
    handleUnown,
    handleUpdateAcquisition,
    handleToggleFavorite,
  };
}