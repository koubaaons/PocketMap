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
    ACTIONS.CARD_ADD, ACTIONS.CARD_UPDATE, ACTIONS.CARD_DELETE,
    ACTIONS.BIN_RESTORE, ACTIONS.BIN_DELETE, ACTIONS.BIN_EMPTY,
    ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
    ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_BULK_ADD, ACTIONS.TEMPLATE_FIELD_UPDATE,
    ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_BULK_ADD,
    ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_DELETE,
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
          // === MILESTONE 2: persist local user ===
          user: state.user,
          // === END: persist local user ===
          binders: state.binders,
          cards: state.cards,
          bin: state.bin,
          collections: state.collections,
          templateFields: state.templateFields,
          cardDefinitions: state.cardDefinitions,
          inventory: state.inventory,
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