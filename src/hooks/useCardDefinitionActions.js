/**
 * @fileoverview useCardDefinitionActions hook.
 * Encapsulates create, update, delete dispatch logic for card definitions.
 */

// === ISSUE #13 START: Card Definition Management — useCardDefinitionActions hook ===

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';

/**
 * @param {(message: string, type?: string) => void} toast
 * @param {{ onCreateSuccess?: () => void, onUpdateSuccess?: () => void, onDeleteSuccess?: () => void }} callbacks
 */
export function useCardDefinitionActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  /**
   * Creates a new card definition.
   * @param {object} cardDef - validated card definition object
   */
  const handleCreate = useCallback((cardDef) => {
    dispatch({ type: ACTIONS.CARD_DEFINITION_ADD, payload: cardDef });
    toast(`"${cardDef.name}" added`);
    callbacks.onCreateSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Updates an existing card definition.
   * @param {object} updated - updated card definition object
   */
  const handleUpdate = useCallback((updated) => {
    dispatch({ type: ACTIONS.CARD_DEFINITION_UPDATE, payload: updated });
    toast(`"${updated.name}" updated`);
    callbacks.onUpdateSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Deletes a card definition.
   * Cascades to inventory entries referencing this card.
   * @param {string} cardDefId
   * @param {string} cardName - for toast message
   */
  const handleDelete = useCallback((cardDefId, cardName) => {
    dispatch({ type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId } });
    toast(`"${cardName}" deleted`);
    callbacks.onDeleteSuccess?.();
  }, [dispatch, toast, callbacks]);

  return { handleCreate, handleUpdate, handleDelete };
}

// === ISSUE #13 END: Card Definition Management — useCardDefinitionActions hook ===