/**
 * @fileoverview sessionReducer — Cross-cutting session state — current navigation, auth, and hydrating the whole store from Supabase on load.
 *
 * Split out of the monolithic reducer.js (was a single 900+ line, 43-
 * case switch statement) for scalability, matching the domain groups
 * identified during a full code audit. Each domain file still takes
 * and returns the FULL app state, exactly like the original switch
 * cases did — this isn't a classic Redux combineReducers split, since
 * several actions here genuinely need to read/write multiple slices
 * of state at once (e.g. deleting a card definition also has to clean
 * up its binder slots and inventory). The root reducer.js just routes
 * each action type to the right domain file instead of handling
 * everything in one switch.
 */

import { ACTIONS } from '../actionTypes.js';

export function sessionReducer(state, action) {
  switch (action.type) {


    case ACTIONS.NAV_SET:
      return { ...state, nav: { ...state.nav, ...action.payload } };


    case ACTIONS.AUTH_SET: {
      const newUserId = action.payload?.id ?? null;
      // === Real bug fixed: AUTH_SET was defined and even already
      // listed as a persisted action, but nothing in the app ever
      // actually dispatched it — state.user just sat at its
      // DEFAULT_STATE placeholder forever, completely disconnected
      // from the real Supabase-authenticated user. Now genuinely
      // wired up (see useSupabaseSync.js), and — the actual fix —
      // clears every server-sourced field the moment the account
      // changes to a DIFFERENT one, so a previous account's data can
      // never be shown, edited, or persisted under a new account's
      // identity, even for the brief moment before a fresh load
      // completes (or, worse, if that fresh load ever fails). ===
      if (state.currentUserId && state.currentUserId !== newUserId) {
        return {
          ...state,
          user: action.payload,
          currentUserId: newUserId,
          binders: [], binderSlots: [], binderInserts: [], binderPanels: [],
          collections: [], templateFields: [], cardDefinitions: [],
          inventory: [], bin: [],
        };
      }
      return { ...state, user: action.payload, currentUserId: newUserId };
    }


    case ACTIONS.HYDRATE:
      return {
        ...state,
        binders:         action.payload.binders         ?? state.binders,
        binderSlots:     action.payload.binderSlots     ?? state.binderSlots,
        binderInserts:   action.payload.binderInserts   ?? state.binderInserts,
        binderPanels:    action.payload.binderPanels    ?? state.binderPanels,
        collections:     action.payload.collections     ?? state.collections,
        templateFields:  action.payload.templateFields  ?? state.templateFields,
        cardDefinitions: action.payload.cardDefinitions ?? state.cardDefinitions,
        inventory:       action.payload.inventory       ?? state.inventory,
        bin:             action.payload.bin             ?? state.bin,
      };
    default:
      return state;
  }
}
