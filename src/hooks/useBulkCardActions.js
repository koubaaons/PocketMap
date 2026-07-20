/**
 * @fileoverview useBulkCardActions hook.
 *
 * Bulk counterparts to useInventoryActions/useCardDefinitionActions,
 * for multiselect — mark several cards owned/unowned/favorited, or
 * declutter/restore several at once, in a single dispatch each rather
 * than looping the single-card action per card (which would still
 * work, but would mean N separate localStorage saves + N separate
 * Supabase sync bursts instead of one coordinated batch — the exact
 * "burst of simultaneous writes" problem CARD_DEFINITION_BULK_ADD was
 * fixed for, avoided here from the start by using the real bulk
 * actions the reducer/sync layer already support).
 */

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { createInventoryItem } from '../types/index.js';

export function useBulkCardActions(toast) {
  const dispatch = useDispatch();

  /**
   * Marks every given (not-yet-owned) card as owned — one new
   * inventory copy each.
   * @param {{id: string}[]} cardDefs
   * @param {string} collectionId
   */
  const handleBulkOwn = useCallback((cardDefs, collectionId) => {
    const items = [];
    for (const cd of cardDefs) {
      const { item, errors } = createInventoryItem({ cardDefId: cd.id, collectionId });
      if (item) items.push(item);
      else console.error('[Pinder] bulk own failed for', cd.id, errors);
    }
    if (items.length === 0) return;
    dispatch({ type: ACTIONS.INVENTORY_BULK_ADD, payload: { items } });
    toast(`Marked ${items.length} card${items.length !== 1 ? 's' : ''} as owned`);
  }, [dispatch, toast]);

  /**
   * Removes ownership for every given inventory item id (every copy
   * of every selected owned card — a card owned twice needs both its
   * copies removed to stop counting as owned at all).
   * @param {string[]} inventoryIds
   */
  const handleBulkUnown = useCallback((inventoryIds) => {
    if (inventoryIds.length === 0) return;
    dispatch({ type: ACTIONS.INVENTORY_BULK_DELETE, payload: { inventoryIds } });
    toast(`Removed ownership from ${inventoryIds.length} cop${inventoryIds.length !== 1 ? 'ies' : 'y'}`);
  }, [dispatch, toast]);

  /**
   * Sets is_favorite on the given inventory item ids (one
   * representative copy per selected card — matches the single-card
   * favorite star, which always acts on one representative copy too).
   * @param {string[]} inventoryIds
   * @param {boolean} isFavorite
   */
  const handleBulkSetFavorite = useCallback((inventoryIds, isFavorite) => {
    if (inventoryIds.length === 0) return;
    dispatch({ type: ACTIONS.INVENTORY_BULK_SET_FAVORITE, payload: { ids: inventoryIds, isFavorite } });
    toast(isFavorite
      ? `Added ${inventoryIds.length} card${inventoryIds.length !== 1 ? 's' : ''} to favorites`
      : `Removed ${inventoryIds.length} card${inventoryIds.length !== 1 ? 's' : ''} from favorites`);
  }, [dispatch, toast]);

  /**
   * Declutters (or restores) every given card definition id.
   * @param {string[]} cardDefIds
   * @param {boolean} isDecluttered
   */
  const handleBulkSetDecluttered = useCallback((cardDefIds, isDecluttered) => {
    if (cardDefIds.length === 0) return;
    dispatch({ type: ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED, payload: { ids: cardDefIds, isDecluttered } });
    toast(isDecluttered
      ? `Decluttered ${cardDefIds.length} card${cardDefIds.length !== 1 ? 's' : ''}`
      : `Restored ${cardDefIds.length} card${cardDefIds.length !== 1 ? 's' : ''}`);
  }, [dispatch, toast]);

  return { handleBulkOwn, handleBulkUnown, handleBulkSetFavorite, handleBulkSetDecluttered };
}