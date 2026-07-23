/**
 * @fileoverview Supabase write router — all per-entity write operations.
 *
 * === CHANGED: this used to be a single ~850-line function handling
 * all 39 synced action types in one switch statement — flagged during
 * a full code audit as the second biggest structural risk to this
 * app's scalability, alongside the reducer itself (which got the same
 * treatment — see reducer.js's own comment). Split into 9 domain-
 * grouped files under store/reducers/sync/, matching the exact same
 * domain groups used for the reducer split, plus a shared
 * syncHelpers.js for the upsert/delete functions used across more
 * than one domain (upsertBinItem/deleteBinItem/emptyBin in
 * particular — several domains' delete cascades touch the Bin/Trash
 * table, not just the Bin domain itself).
 *
 * Each domain file has the same shape the original switch cases did:
 * push zero or more pending write promises onto a shared `pending`
 * array — this file just builds the dispatch table, calls whichever
 * domain owns the action, and awaits everything collected via
 * Promise.allSettled once the right domain handler (if any) has run.
 *
 * Every write is still fire-and-forget as far as the UI is concerned —
 * Supabase calls are not awaited before the UI updates, so nothing ever
 * blocks a re-render. BUT syncToSupabase still returns a Promise that
 * resolves once every write it kicked off has actually settled, and
 * store/index.js tracks that promise so anything else (specifically,
 * useSupabaseSync.js's realtime handler) can wait for pending writes
 * to finish before doing anything that depends on the database being
 * caught up.
 *
 * Exports a single function: syncToSupabase(action, nextState, prevState)
 * Called by store/index.js after every persisted action.
 */

import { ACTIONS } from './actionTypes.js';

import { binderSync } from './reducers/sync/binderSync.js';
import { collectionSync } from './reducers/sync/collectionSync.js';
import { templateFieldSync } from './reducers/sync/templateFieldSync.js';
import { cardDefinitionSync } from './reducers/sync/cardDefinitionSync.js';
import { inventorySync } from './reducers/sync/inventorySync.js';
import { binderSlotSync } from './reducers/sync/binderSlotSync.js';
import { binderInsertSync } from './reducers/sync/binderInsertSync.js';
import { binderPanelSync } from './reducers/sync/binderPanelSync.js';
import { binSync } from './reducers/sync/binSync.js';

// One entry per synced action type → the domain sync file that owns
// it, built once at module load exactly like reducer.js's own
// dispatch table. Four action types (AUTH_SET, HYDRATE, NAV_SET, and
// BINDER_SLOT_UPDATE) are deliberately absent — the first three are
// pure client-side/session state never persisted to Supabase at all,
// and BINDER_SLOT_UPDATE has no dedicated sync case in the original
// file either (a slot's owner-facing fields sync through other
// actions instead).
const DOMAIN_SYNCS = [
  { handler: binderSync, types: [
    ACTIONS.BINDER_ADD, ACTIONS.BINDER_UPDATE, ACTIONS.BINDER_ADD_PAGE,
    ACTIONS.BINDER_SWAP_PAGES, ACTIONS.BINDER_DELETE,
  ] },
  { handler: collectionSync, types: [
    ACTIONS.COLLECTION_ADD, ACTIONS.COLLECTION_UPDATE, ACTIONS.COLLECTION_DELETE,
  ] },
  { handler: templateFieldSync, types: [
    ACTIONS.TEMPLATE_FIELD_ADD, ACTIONS.TEMPLATE_FIELD_UPDATE,
    ACTIONS.TEMPLATE_FIELD_BULK_ADD, ACTIONS.TEMPLATE_FIELD_REORDER,
  ] },
  { handler: cardDefinitionSync, types: [
    ACTIONS.CARD_DEFINITION_ADD, ACTIONS.CARD_DEFINITION_UPDATE, ACTIONS.CARD_DEFINITION_BULK_ADD,
    ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED, ACTIONS.CARD_DEFINITION_DELETE,
  ] },
  { handler: inventorySync, types: [
    ACTIONS.INVENTORY_ADD, ACTIONS.INVENTORY_UPDATE, ACTIONS.INVENTORY_DELETE,
    ACTIONS.INVENTORY_BULK_ADD, ACTIONS.INVENTORY_BULK_DELETE, ACTIONS.INVENTORY_BULK_SET_FAVORITE,
  ] },
  { handler: binderSlotSync, types: [
    ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_MOVE, ACTIONS.BINDER_SLOT_REMOVE,
  ] },
  { handler: binderInsertSync, types: [
    ACTIONS.BINDER_INSERT_ADD, ACTIONS.BINDER_INSERT_BULK_ADD,
    ACTIONS.BINDER_INSERT_DELETE, ACTIONS.BINDER_INSERT_BULK_DELETE,
  ] },
  { handler: binderPanelSync, types: [
    ACTIONS.BINDER_PANEL_ADD, ACTIONS.BINDER_PANEL_UPDATE, ACTIONS.BINDER_PANEL_REMOVE,
  ] },
  { handler: binSync, types: [
    ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION, ACTIONS.BIN_RESTORE_CARD,
    ACTIONS.BIN_RESTORE_INSERT, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
  ] },
];

const actionTypeToSyncHandler = new Map();
for (const { handler, types } of DOMAIN_SYNCS) {
  for (const type of types) actionTypeToSyncHandler.set(type, handler);
}

export function syncToSupabase(action, nextState, prevState) {
  const pending = [];

  const handler = actionTypeToSyncHandler.get(action.type);
  if (handler) handler(action, nextState, prevState, pending);

  return Promise.allSettled(pending);
}
