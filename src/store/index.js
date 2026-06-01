/**
 * @fileoverview Application Store — the single source of truth.
 *
 * Connects the pure reducer to the persistence layer and provides
 * a pub/sub model for components to react to state changes.
 *
 * Pattern: a lightweight hand-rolled store (Redux-style) so we have
 * zero dependencies and the architecture is fully transparent.
 *
 * Usage:
 *   import { store } from './store/index.js';
 *   store.dispatch({ type: ACTIONS.CARD_ADD, payload: card });
 *   store.subscribe(state => renderMyComponent(state));
 *   const state = store.getState();
 */

import { reducer, ACTIONS } from './reducer.js';
import { loadState, saveState } from './storage.js';

// ─── Initial state ────────────────────────────────────────────────────────────

function buildInitialState() {
  const persisted = loadState();
  return {
    ...persisted,
    // Navigation state is always transient — never persisted
    nav: {
      currentView: 'home',      // 'home' | 'binder' | 'search' | 'favorites' | 'bin'
      currentBinderId: null,
      currentPage: 1,
    },
  };
}

// ─── Store factory ────────────────────────────────────────────────────────────

function createStore(reducerFn, initialState) {
  let state = initialState;
  const listeners = new Set();

  // Navigation actions don't need to persist to disk
  const PERSISTED_ACTIONS = new Set([
    ACTIONS.BINDER_ADD, ACTIONS.BINDER_UPDATE, ACTIONS.BINDER_DELETE,
    ACTIONS.CARD_ADD, ACTIONS.CARD_UPDATE, ACTIONS.CARD_DELETE,
    ACTIONS.BIN_RESTORE, ACTIONS.BIN_DELETE, ACTIONS.BIN_EMPTY,
  ]);

  return {
    getState() {
      return state;
    },

    dispatch(action) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Store] dispatch', action.type, action.payload ?? '');
      }

      const nextState = reducerFn(state, action);
      if (nextState === state) return; // no-op, skip re-render

      state = nextState;

      if (PERSISTED_ACTIONS.has(action.type)) {
        const { success } = saveState({
          version: state.version,
          binders: state.binders,
          cards: state.cards,
          bin: state.bin,
        });
        if (!success) {
          // Notify UI of save failure without crashing
          listeners.forEach(fn => fn(state, { saveError: true }));
          return;
        }
      }

      listeners.forEach(fn => fn(state));
    },

    /**
     * Subscribe to state changes.
     * @param {(state: object, meta?: object) => void} listener
     * @returns {() => void} Unsubscribe function
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const store = createStore(reducer, buildInitialState());
export { ACTIONS };