/**
 * @fileoverview Application Store — single source of truth.
 */

import { reducer, ACTIONS } from './reducer.js';
import { loadState, saveState } from './storage.js';

function buildInitialState() {
  const persisted = loadState();
  return {
    ...persisted,
    nav: {
      currentView: 'home',
      currentBinderId: null,
      currentCollectionId: null,
      currentPage: 1,
    },
  };
}

function createStore(reducerFn, initialState) {
  let state = initialState;
  const listeners = new Set();

  const PERSISTED_ACTIONS = new Set([
    ACTIONS.BINDER_ADD, ACTIONS.BINDER_UPDATE, ACTIONS.BINDER_DELETE,
    ACTIONS.BINDER_ADD_PAGE,
    ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
    ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_BULK_ADD,
    ACTIONS.TEMPLATE_FIELD_UPDATE, ACTIONS.TEMPLATE_FIELD_REORDER,
    ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_BULK_ADD,
    ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_DELETE,
    ACTIONS.INVENTORY_ADD, ACTIONS.INVENTORY_UPDATE, ACTIONS.INVENTORY_DELETE,
    // === ISSUE #53 START: persist binder slot actions ===
    ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_REMOVE, ACTIONS.BINDER_SLOT_MOVE,
    // === ISSUE #53 END ===
    // === ISSUE #57 START: persist bin actions ===
    ACTIONS.AUTH_SET,
    ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION,
    ACTIONS.BIN_RESTORE_CARD, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
    // === ISSUE #57 END ===
  ]);

  return {
    getState() { return state; },

    dispatch(action) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Store] dispatch', action.type, action.payload ?? '');
      }
      const nextState = reducerFn(state, action);
      if (nextState === state) return;
      state = nextState;

      if (PERSISTED_ACTIONS.has(action.type)) {
        const { success } = saveState({
          version: state.version,
          user: state.user,
          binders: state.binders,
          bin: state.bin,
          collections: state.collections,
          templateFields: state.templateFields,
          cardDefinitions: state.cardDefinitions,
          inventory: state.inventory,
          // === ISSUE #53 START: persist binder slots ===
          binderSlots: state.binderSlots,
          // === ISSUE #53 END ===
        });
        if (!success) {
          listeners.forEach(fn => fn(state, { saveError: true }));
          return;
        }
      }

      listeners.forEach(fn => fn(state));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const store = createStore(reducer, buildInitialState());
export { ACTIONS };