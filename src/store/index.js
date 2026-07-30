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
import { DEFAULT_STATE, saveState } from './storage.js';
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
  // === CHANGED: no longer loads any localStorage cache here at all.
  // This runs at module load, before auth has resolved — there's no
  // way to know which account's cache to load yet, and guessing
  // (the old behavior: always load the single global key) is exactly
  // the bug that let one account's data leak into another's session.
  // useSupabaseSync.js now loads the correct, user-scoped cache
  // itself once the real logged-in user is actually known.
  return {
    ...DEFAULT_STATE,
    currentUserId: null,
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
  ACTIONS.BINDER_ADD_PAGE, ACTIONS.BINDER_SWAP_PAGES,
  ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
  ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_BULK_ADD,
  ACTIONS.TEMPLATE_FIELD_UPDATE, ACTIONS.TEMPLATE_FIELD_REORDER,
  ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_BULK_ADD,
  ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_DELETE,
  ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED,
  ACTIONS.INVENTORY_ADD, ACTIONS.INVENTORY_UPDATE, ACTIONS.INVENTORY_DELETE,
  ACTIONS.INVENTORY_BULK_ADD, ACTIONS.INVENTORY_BULK_DELETE, ACTIONS.INVENTORY_BULK_SET_FAVORITE,
  ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_REMOVE, ACTIONS.BINDER_SLOT_MOVE,
  ACTIONS.BINDER_INSERT_ADD, ACTIONS.BINDER_INSERT_BULK_ADD, ACTIONS.BINDER_INSERT_DELETE, ACTIONS.BINDER_INSERT_BULK_DELETE,
  ACTIONS.BINDER_PANEL_ADD, ACTIONS.BINDER_PANEL_UPDATE, ACTIONS.BINDER_PANEL_REMOVE,
  ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION,
  ACTIONS.BIN_RESTORE_CARD, ACTIONS.BIN_RESTORE_INSERT, ACTIONS.BIN_RESTORE_INVENTORY_ITEM, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
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
      if (nextState === state) return Promise.resolve();
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
          binderInserts:   state.binderInserts,
          binderPanels:    state.binderPanels,
        }, state.currentUserId);
        if (!success) {
          listeners.forEach(fn => fn(state, { saveError: true }));
          return Promise.resolve();
        }

        // 2. Sync to Supabase (fire-and-forget as far as the UI is
        // concerned — not awaited here by default, so nothing blocks.
        // Its returned promise IS tracked, so realtime can wait for
        // it (see waitForPendingSyncs above), AND now also returned
        // from dispatch itself, so a caller that genuinely needs
        // ordering (e.g. a collection must exist before any card
        // referencing it via a foreign key is written) can explicitly
        // await dispatch(...) for just that one call, without forcing
        // every other dispatch call site to change at all.
        const syncPromise = syncToSupabase(action, nextState, prevState);
        pendingSyncs.add(syncPromise);
        syncPromise.finally(() => pendingSyncs.delete(syncPromise));

        listeners.forEach(fn => fn(state));
        return syncPromise;
      }

      listeners.forEach(fn => fn(state));
      return Promise.resolve();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const store = createStore(reducer, buildInitialState());
export { ACTIONS };