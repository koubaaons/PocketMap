/**
 * @fileoverview Pure reducer — all state transitions live here.
 * No side effects. No localStorage, no DOM, no fetch.
 *
 * === CHANGED: this used to be a single ~900-line function handling
 * all 43 action types in one switch statement — flagged during a full
 * code audit as the biggest structural risk to this app's
 * scalability (dream binders alone will likely add another 5-10
 * action types to it). Split into 10 domain-grouped files under
 * store/reducers/, each still taking and returning the FULL app
 * state exactly like the original switch cases did (this isn't a
 * classic Redux combineReducers split — several actions genuinely
 * need to read/write multiple slices of state at once). This file is
 * now just the O(1) dispatch table routing each action type to the
 * domain file that owns it, plus the same "unknown action" fallback
 * the original switch's default case had. ACTIONS itself moved to its
 * own file (actionTypes.js) so every domain file can import it
 * without a circular import back here.
 *
 * Every domain reducer file, and this dispatch table, are covered by
 * the exact same reducer.test.js suite that covered the original
 * monolithic switch — this split changes nothing about
 * reducer(state, action)'s inputs or outputs, only how the file
 * itself is organized internally.
 */

import { ACTIONS } from './actionTypes.js';

import { binderReducer } from './reducers/binderReducer.js';
import { binReducer } from './reducers/binReducer.js';
import { sessionReducer } from './reducers/sessionReducer.js';
import { collectionReducer } from './reducers/collectionReducer.js';
import { templateFieldReducer } from './reducers/templateFieldReducer.js';
import { cardDefinitionReducer } from './reducers/cardDefinitionReducer.js';
import { inventoryReducer } from './reducers/inventoryReducer.js';
import { binderSlotReducer } from './reducers/binderSlotReducer.js';
import { binderInsertReducer } from './reducers/binderInsertReducer.js';
import { binderPanelReducer } from './reducers/binderPanelReducer.js';

export { ACTIONS };

// One entry per action type → the domain reducer that owns it. Built
// once, at module load, from each domain's own action-type list, so
// domain groupings only ever need to be updated in one place (the
// arrays below) rather than kept in sync with a separate dispatch map.
const DOMAIN_REDUCERS = [
  { handler: binderReducer, types: [
    ACTIONS.BINDER_ADD, ACTIONS.BINDER_UPDATE, ACTIONS.BINDER_DELETE,
    ACTIONS.BINDER_ADD_PAGE, ACTIONS.BINDER_SWAP_PAGES,
  ] },
  { handler: binReducer, types: [
    ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION, ACTIONS.BIN_RESTORE_CARD,
    ACTIONS.BIN_RESTORE_INSERT, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
  ] },
  { handler: sessionReducer, types: [
    ACTIONS.NAV_SET, ACTIONS.AUTH_SET, ACTIONS.HYDRATE,
  ] },
  { handler: collectionReducer, types: [
    ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
  ] },
  { handler: templateFieldReducer, types: [
    ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_BULK_ADD,
    ACTIONS.TEMPLATE_FIELD_UPDATE, ACTIONS.TEMPLATE_FIELD_REORDER,
  ] },
  { handler: cardDefinitionReducer, types: [
    ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_BULK_ADD,
    ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_DELETE,
    ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED,
  ] },
  { handler: inventoryReducer, types: [
    ACTIONS.INVENTORY_ADD, ACTIONS.INVENTORY_UPDATE, ACTIONS.INVENTORY_DELETE,
    ACTIONS.INVENTORY_BULK_ADD, ACTIONS.INVENTORY_BULK_DELETE, ACTIONS.INVENTORY_BULK_SET_FAVORITE,
  ] },
  { handler: binderSlotReducer, types: [
    ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_UPDATE,
    ACTIONS.BINDER_SLOT_REMOVE, ACTIONS.BINDER_SLOT_MOVE,
  ] },
  { handler: binderInsertReducer, types: [
    ACTIONS.BINDER_INSERT_ADD, ACTIONS.BINDER_INSERT_BULK_ADD,
    ACTIONS.BINDER_INSERT_DELETE, ACTIONS.BINDER_INSERT_BULK_DELETE,
  ] },
  { handler: binderPanelReducer, types: [
    ACTIONS.BINDER_PANEL_ADD, ACTIONS.BINDER_PANEL_UPDATE, ACTIONS.BINDER_PANEL_REMOVE,
  ] },
];

const actionTypeToHandler = new Map();
for (const { handler, types } of DOMAIN_REDUCERS) {
  for (const type of types) actionTypeToHandler.set(type, handler);
}

export function reducer(state, action) {
  const handler = actionTypeToHandler.get(action.type);
  if (handler) return handler(state, action);

  console.warn('[Pinder] Unknown action type:', action.type);
  return state;
}
