/**
 * @fileoverview Application Store — single source of truth.
 *
 * Lean store creation and dispatch. Supabase write logic lives in
 * supabaseSync.js. localStorage logic lives in storage.js.
 * Supabase read/convert logic lives in supabaseStorage.js.
 *
 * Adding new entity types in Milestone 12 only requires changes to
 * supabaseSync.js and supabaseStorage.js — this file stays stable.
 */

import { reducer, ACTIONS } from './reducer.js';
import { loadState, saveState } from './storage.js';
import { syncToSupabase } from './supabaseSync.js';

const DEBUG = import.meta.env.DEV;

// === FIX (realtime re-fetch racing ahead of a local write — see
// supabaseSync.js's file header for the full explanation): every
// syncToSupabase call's returned promise gets tracked here so
// useSupabaseSync.js's realtime handler can wait for all currently
// in-flight writes to actually finish before re-fetching and
// overwriting local state with what might otherwise be stale data. ===
const pendingSyncs = new Set();

export function waitForPendingSyncs() {
  return Promise.allSettled([...pendingSyncs]);
}

function buildInitialState() {
  const persisted = loadState();
  return {
    ...persisted,
    nav: {
      currentView:         'home',
      currentBinderId:     null,
      currentCollectionId: null,
      currentPage:         1,
    },
  };
}

const PERSISTED_ACTIONS = new Set([
  ACTIONS.BINDER_ADD, ACTIONS.BINDER_UPDATE, ACTIONS.BINDER_DELETE,
  ACTIONS.BINDER_ADD_PAGE,
  ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
  ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_BULK_ADD,
  ACTIONS.TEMPLATE_FIELD_UPDATE, ACTIONS.TEMPLATE_FIELD_REORDER,
  ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_BULK_ADD,
  ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_DELETE,
  ACTIONS.INVENTORY_ADD, ACTIONS.INVENTORY_UPDATE, ACTIONS.INVENTORY_DELETE,
  ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_REMOVE, ACTIONS.BINDER_SLOT_MOVE,
  ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION,
  ACTIONS.BIN_RESTORE_CARD, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
  ACTIONS.AUTH_SET,
]);

function createStore(reducerFn, initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() { return state; },

    dispatch(action) {
      DEBUG && console.debug('[Store] dispatch', action.type, action.payload ?? '');

      const prevState = state; // capture BEFORE reducer runs
      const nextState = reducerFn(state, action);
      if (nextState === state) return;
      state = nextState;

      if (PERSISTED_ACTIONS.has(action.type)) {
        // 1. Keep localStorage cache in sync (synchronous, instant)
        const { success } = saveState({
          version:         state.version,
          user:            state.user,
          binders:         state.binders,
          bin:             state.bin,
          collections:     state.collections,
          templateFields:  state.templateFields,
          cardDefinitions: state.cardDefinitions,
          inventory:       state.inventory,
          binderSlots:     state.binderSlots,
        });
        if (!success) {
          listeners.forEach(fn => fn(state, { saveError: true }));
          return;
        }

        // 2. Sync to Supabase (fire-and-forget as far as the UI is
        // concerned — not awaited here, so nothing blocks). Its
        // returned promise IS tracked, though, so realtime can wait
        // for it — see waitForPendingSyncs above.
        const syncPromise = syncToSupabase(action, nextState, prevState);
        pendingSyncs.add(syncPromise);
        syncPromise.finally(() => pendingSyncs.delete(syncPromise));
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