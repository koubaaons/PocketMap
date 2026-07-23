/**
 * @fileoverview useCollectionActions hook.
 *
 * Encapsulates all collection-related dispatch logic so CollectionsView
 * stays clean. If the dispatch logic ever changes (optimistic updates,
 * API calls, error handling), this is the only file that needs to change.
 *
 * Usage:
 *   const { handleCreate, handleEdit, handleDelete } = useCollectionActions(toast);
 */

import { useCallback } from 'react';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';

/**
 * @param {(message: string, type?: string) => void} toast
 * @param {{ onCreateSuccess?: () => void, onDeleteSuccess?: () => void }} callbacks
 */
export function useCollectionActions(toast, callbacks = {}) {
  const dispatch = useDispatch();

  /**
   * Creates a collection along with its template fields and card definitions.
   * All three are dispatched atomically — if any part is missing it's skipped.
   * @param {{ collection: object, templateFields: object[], cardDefinitions: object[] }} payload
   */
  const handleCreate = useCallback(async (payload) => {
    // === FIX (real bug: bulk imports always losing exactly one
    // card, consistently the first one processed): these three
    // dispatches used to fire back-to-back with zero waiting between
    // them. card_definitions.collection_id has a foreign key
    // constraint referencing collections(id) — if the very first
    // card's write reached the database before the collection's own
    // insert had actually committed, it failed with a transient
    // foreign key violation, while every card after it succeeded
    // (by then the collection was definitely already there). Now
    // awaits the collection's own dispatch/sync before writing
    // anything that depends on it existing first.
    await dispatch({ type: ACTIONS.COLLECTION_ADD, payload: payload.collection });

    if (payload.templateFields?.length) {
      dispatch({ type: ACTIONS.TEMPLATE_FIELD_BULK_ADD, payload: payload.templateFields });
    }
    if (payload.cardDefinitions?.length) {
      dispatch({ type: ACTIONS.CARD_DEFINITION_BULK_ADD, payload: payload.cardDefinitions });
    }

    toast(`Collection "${payload.collection.name}" created`);
    callbacks.onCreateSuccess?.();
  }, [dispatch, toast, callbacks]);

  /**
   * Updates a collection's name and metadata.
   * @param {object} updated
   */
  const handleEdit = useCallback((updated) => {
    dispatch({ type: ACTIONS.COLLECTION_UPDATE, payload: updated });
    toast('Collection updated');
  }, [dispatch, toast]);

  /**
   * Deletes a collection with full cascade:
   * binder slots → inventory → card definitions → template fields → collection
   * @param {string} collectionId
   */
  const handleDelete = useCallback((collectionId) => {
    dispatch({ type: ACTIONS.COLLECTION_DELETE, payload: { collectionId } });
    toast('Collection deleted');
    callbacks.onDeleteSuccess?.();
  }, [dispatch, toast, callbacks]);

  return { handleCreate, handleEdit, handleDelete };
}