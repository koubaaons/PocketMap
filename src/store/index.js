/**
 * @fileoverview Application Store — single source of truth.
 *
 * === Issue #116: Per-Entity Supabase Writes ===
 * Every persisted action now triggers a Supabase write in addition to
 * the existing localStorage saveState call. localStorage stays as a
 * local cache for instant reads; Supabase is the authoritative source.
 *
 * Supabase writes are fire-and-forget (not awaited) so they never
 * block the UI — the local state update and re-render happen
 * immediately, and the Supabase write happens in the background.
 * Failures are logged to the console; full error recovery (retry,
 * offline queue) is a Milestone 20 concern.
 */

import { reducer, ACTIONS } from './reducer.js';
import {
  loadState, saveState,
  binderToRow, binderSlotToRow,
  collectionToRow, templateFieldToRow,
  cardDefinitionToRow, inventoryItemToRow,
} from './storage.js';
import { supabase } from '../services/supabase.js';

const DEBUG = import.meta.env.DEV;

// Get the real Supabase user id — never trust the userId stored on
// entities since old data may have 'local-user-1' as a placeholder.
async function getRealUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function buildInitialState() {
  const persisted = loadState();
  return {
    ...persisted,
    nav: {
      currentView:        'home',
      currentBinderId:    null,
      currentCollectionId: null,
      currentPage:        1,
    },
  };
}

// ── Supabase write helpers ────────────────────────────────────────────────────
// Each helper is fire-and-forget — called with .catch() so unhandled
// promise rejections don't surface as errors in the console.

function upsertBinder(binder) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('binders').upsert({ ...binderToRow(binder), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] binder upsert failed:', error); })
      .catch(err => console.error('[Store] binder upsert error:', err));
  });
}

function deleteBinder(binderId) {
  supabase.from('binders').delete().eq('id', binderId)
    .then(({ error }) => { if (error) console.error('[Store] binder delete failed:', error); })
    .catch(err => console.error('[Store] binder delete error:', err));
}

function upsertCollection(collection) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('collections').upsert({ ...collectionToRow(collection), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] collection upsert failed:', error); })
      .catch(err => console.error('[Store] collection upsert error:', err));
  });
}

function deleteCollection(collectionId) {
  supabase.from('collections').delete().eq('id', collectionId)
    .then(({ error }) => { if (error) console.error('[Store] collection delete failed:', error); })
    .catch(err => console.error('[Store] collection delete error:', err));
}

function deleteTemplateField(fieldId) {
  supabase.from('template_fields').delete().eq('id', fieldId)
    .then(({ error }) => { if (error) console.error('[Store] template field delete failed:', error); })
    .catch(err => console.error('[Store] template field delete error:', err));
}

function upsertTemplateField(field) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('template_fields').upsert({ ...templateFieldToRow(field), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] template field upsert failed:', error); })
      .catch(err => console.error('[Store] template field upsert error:', err));
  });
}

function upsertCardDefinition(cd) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('card_definitions').upsert({ ...cardDefinitionToRow(cd), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] card definition upsert failed:', error); })
      .catch(err => console.error('[Store] card definition upsert error:', err));
  });
}

function deleteCardDefinition(cardDefId) {
  supabase.from('card_definitions').delete().eq('id', cardDefId)
    .then(({ error }) => { if (error) console.error('[Store] card definition delete failed:', error); })
    .catch(err => console.error('[Store] card definition delete error:', err));
}

function upsertInventoryItem(item) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('user_inventory').upsert({ ...inventoryItemToRow(item), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] inventory upsert failed:', error); })
      .catch(err => console.error('[Store] inventory upsert error:', err));
  });
}

function deleteInventoryItem(itemId) {
  supabase.from('user_inventory').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Store] inventory delete failed:', error); })
    .catch(err => console.error('[Store] inventory delete error:', err));
}

function upsertBinderSlot(slot) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('binder_slots').upsert({ ...binderSlotToRow(slot), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Store] binder slot upsert failed:', error); })
      .catch(err => console.error('[Store] binder slot upsert error:', err));
  });
}

function deleteBinderSlot(slotId) {
  supabase.from('binder_slots').delete().eq('id', slotId)
    .then(({ error }) => { if (error) console.error('[Store] binder slot delete failed:', error); })
    .catch(err => console.error('[Store] binder slot delete error:', err));
}

function upsertBinItem(item, entityType) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('bin').upsert({
      id:          item.id,
      user_id:     userId,
      entity_type: entityType,
      deleted_at:  new Date(item.deletedAt).toISOString(),
      snapshot:    item,
    })
      .then(({ error }) => { if (error) console.error('[Store] bin upsert failed:', error); })
      .catch(err => console.error('[Store] bin upsert error:', err));
  });
}

function deleteBinItem(itemId) {
  supabase.from('bin').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Store] bin delete failed:', error); })
    .catch(err => console.error('[Store] bin delete error:', err));
}

function emptyBin(userId) {
  supabase.from('bin').delete().eq('user_id', userId)
    .then(({ error }) => { if (error) console.error('[Store] bin empty failed:', error); })
    .catch(err => console.error('[Store] bin empty error:', err));
}

// ── Store ─────────────────────────────────────────────────────────────────────

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
    ACTIONS.BINDER_SLOT_ADD, ACTIONS.BINDER_SLOT_REMOVE, ACTIONS.BINDER_SLOT_MOVE,
    ACTIONS.BIN_RESTORE_BINDER, ACTIONS.BIN_RESTORE_COLLECTION,
    ACTIONS.BIN_RESTORE_CARD, ACTIONS.BIN_DELETE_ITEM, ACTIONS.BIN_EMPTY,
    ACTIONS.AUTH_SET,
  ]);

  // ── Per-action Supabase write router ───────────────────────────────────────
  // Called after the reducer has updated local state so we always write
  // the final, post-reducer value to Supabase, not the pre-reducer value.

  function syncToSupabase(action, nextState, prevState) {
    switch (action.type) {

      // ── Binders ──────────────────────────────────────────────────────────────
      case ACTIONS.BINDER_ADD:
      case ACTIONS.BINDER_UPDATE:
      case ACTIONS.BINDER_ADD_PAGE: {
        // Find by id (ADD/UPDATE) or binderId (ADD_PAGE)
        const binder = nextState.binders.find(b => b.id === (action.payload.id ?? action.payload.binderId));
        if (binder) upsertBinder(binder);
        break;
      }
      case ACTIONS.BINDER_DELETE: {
        // Soft delete: mark deleted_at so it's excluded from load queries.
        // Row stays in table so restore can clear deleted_at.
        const { binderId } = action.payload ?? {};
        if (binderId) {
          supabase.from('binders').update({ deleted_at: new Date().toISOString() }).eq('id', binderId)
            .then(({ error }) => { if (error) console.error('[Store] binder soft delete failed:', error); });
          const binItem = nextState.bin.find(b => b.id === binderId);
          if (binItem) upsertBinItem(binItem, 'binder');
        }
        break;
      }

      // ── Collections ──────────────────────────────────────────────────────────
      case ACTIONS.COLLECTION_ADD:
      case ACTIONS.COLLECTION_UPDATE: {
        const col = nextState.collections.find(c => c.id === action.payload.id);
        if (col) upsertCollection(col);
        break;
      }
      case ACTIONS.COLLECTION_DELETE: {
        // Soft delete: mark deleted_at on collection + all its cards + inventory.
        const { collectionId } = action.payload ?? {};
        if (collectionId) {
          const now = new Date().toISOString();
          getRealUserId().then(async userId => {
            if (!userId) return;
            await supabase.from('collections').update({ deleted_at: now }).eq('id', collectionId).eq('user_id', userId);
            const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', collectionId).eq('user_id', userId);
            if (cds?.length) {
              const cdIds = cds.map(c => c.id);
              await supabase.from('card_definitions').update({ deleted_at: now }).in('id', cdIds).eq('user_id', userId);
              await supabase.from('user_inventory').update({ deleted_at: now }).in('card_def_id', cdIds).eq('user_id', userId);
            }
          });
          const binItem = nextState.bin.find(b => b.id === collectionId);
          if (binItem) upsertBinItem(binItem, 'collection');
        }
        break;
      }

      // ── Template fields ───────────────────────────────────────────────────────
      case ACTIONS.TEMPLATE_FIELD_ADD:
      case ACTIONS.TEMPLATE_FIELD_UPDATE: {
        const field = nextState.templateFields.find(f => f.id === action.payload.id);
        if (field) upsertTemplateField(field);
        break;
      }
      case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
        (action.payload ?? []).forEach(f => {
          const field = nextState.templateFields.find(tf => tf.id === f.id);
          if (field) upsertTemplateField(field);
        });
        break;
      }
      case ACTIONS.TEMPLATE_FIELD_REORDER: {
        nextState.templateFields
          .filter(f => f.collectionId === action.payload?.collectionId)
          .forEach(f => upsertTemplateField(f));
        break;
      }

      // ── Card definitions ──────────────────────────────────────────────────────
      case ACTIONS.CARD_DEFINITION_ADD:
      case ACTIONS.CARD_DEFINITION_UPDATE: {
        const cd = nextState.cardDefinitions.find(c => c.id === action.payload.id);
        if (cd) upsertCardDefinition(cd);
        break;
      }
      case ACTIONS.CARD_DEFINITION_BULK_ADD: {
        (action.payload ?? []).forEach(c => {
          const cd = nextState.cardDefinitions.find(d => d.id === c.id);
          if (cd) upsertCardDefinition(cd);
        });
        break;
      }
      case ACTIONS.CARD_DEFINITION_DELETE: {
        // Soft delete: mark deleted_at on card + its inventory item.
        // Row stays so restore can clear deleted_at.
        const { cardDefId } = action.payload ?? {};
        if (cardDefId) {
          const now = new Date().toISOString();
          supabase.from('card_definitions').update({ deleted_at: now }).eq('id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Store] card soft delete failed:', error); });
          supabase.from('user_inventory').update({ deleted_at: now }).eq('card_def_id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Store] inventory soft delete failed:', error); });
          const binItem = nextState.bin.find(b => b.id === cardDefId);
          if (binItem) upsertBinItem(binItem, 'cardDef');
        }
        break;
      }

      // ── Inventory ─────────────────────────────────────────────────────────────
      case ACTIONS.INVENTORY_ADD:
      case ACTIONS.INVENTORY_UPDATE: {
        const item = nextState.inventory.find(i => i.id === action.payload.id);
        if (item) upsertInventoryItem(item);
        break;
      }
      case ACTIONS.INVENTORY_DELETE: {
        // payload: { inventoryId }
        if (action.payload?.inventoryId) deleteInventoryItem(action.payload.inventoryId);
        break;
      }

      // ── Binder slots ──────────────────────────────────────────────────────────
      case ACTIONS.BINDER_SLOT_ADD: {
        const slot = nextState.binderSlots.find(s => s.id === action.payload?.slot?.id);
        if (slot) upsertBinderSlot(slot);
        break;
      }
      case ACTIONS.BINDER_SLOT_MOVE: {
        const slot = nextState.binderSlots.find(s => s.id === action.payload?.slotId);
        if (slot) upsertBinderSlot(slot);
        break;
      }
      case ACTIONS.BINDER_SLOT_REMOVE: {
        if (action.payload?.slotId) deleteBinderSlot(action.payload.slotId);
        break;
      }

      // ── Bin ───────────────────────────────────────────────────────────────────
      // Restore: put entity back in its original table, remove from bin.
      // The snapshot stored at soft-delete time has all the data needed.
      case ACTIONS.BIN_RESTORE_BINDER: {
        // Restore: clear deleted_at so binder reappears on next load.
        const { itemId: binderId } = action.payload ?? {};
        if (binderId) {
          supabase.from('binders').update({ deleted_at: null }).eq('id', binderId)
            .then(({ error }) => { if (error) console.error('[Store] binder restore failed:', error); });
          deleteBinItem(binderId);
        }
        break;
      }
      case ACTIONS.BIN_RESTORE_COLLECTION: {
        // Restore: clear deleted_at on collection + all its cards + inventory.
        const { itemId: colId } = action.payload ?? {};
        if (colId) {
          getRealUserId().then(async userId => {
            if (!userId) return;
            await supabase.from('collections').update({ deleted_at: null }).eq('id', colId).eq('user_id', userId);
            const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', colId).eq('user_id', userId);
            if (cds?.length) {
              const cdIds = cds.map(c => c.id);
              await supabase.from('card_definitions').update({ deleted_at: null }).in('id', cdIds).eq('user_id', userId);
              await supabase.from('user_inventory').update({ deleted_at: null }).in('card_def_id', cdIds).eq('user_id', userId);
            }
          });
          deleteBinItem(colId);
        }
        break;
      }
      case ACTIONS.BIN_RESTORE_CARD: {
        // Restore: clear deleted_at on card + its inventory item.
        const { itemId: cardId } = action.payload ?? {};
        if (cardId) {
          supabase.from('card_definitions').update({ deleted_at: null }).eq('id', cardId)
            .then(({ error }) => { if (error) console.error('[Store] card restore failed:', error); });
          supabase.from('user_inventory').update({ deleted_at: null }).eq('card_def_id', cardId)
            .then(({ error }) => { if (error) console.error('[Store] inventory restore failed:', error); });
          deleteBinItem(cardId);
        }
        break;
      }
      // Delete forever: NOW permanently delete from the original table AND from bin.
      // We use cascade deletes via Supabase where possible, and direct FK queries
      // for child tables — we can't rely on state.inventory/state.cardDefinitions
      // since those items were removed from local state on soft delete.
      case ACTIONS.BIN_DELETE_ITEM: {
        const { itemId } = action.payload ?? {};
        if (!itemId) break;
        const binItem = prevState.bin.find(b => b.id === itemId);
        if (binItem) {
          if (binItem._type === 'binder') {
            // binder_slots has ON DELETE CASCADE from binders, so deleting
            // the binder row also deletes all its slots automatically
            deleteBinder(itemId);
          } else if (binItem._type === 'collection') {
            // Delete inventory items first (FK to card_definitions)
            // then card_definitions (FK to collections)
            // then template_fields (FK to collections)
            // then collection itself
            // Use direct Supabase queries since items are not in local state
            getRealUserId().then(async userId => {
              if (!userId) return;
              // Get all card def ids for this collection
              const { data: cds } = await supabase
                .from('card_definitions')
                .select('id')
                .eq('collection_id', itemId)
                .eq('user_id', userId);
              if (cds?.length) {
                const cdIds = cds.map(c => c.id);
                // Delete inventory items for all cards in this collection
                await supabase.from('user_inventory')
                  .delete().in('card_def_id', cdIds).eq('user_id', userId);
                // Delete binder slots for all cards
                await supabase.from('binder_slots')
                  .delete().in('card_def_id', cdIds).eq('user_id', userId);
              }
              // Delete card definitions, template fields, collection
              await supabase.from('card_definitions').delete().eq('collection_id', itemId).eq('user_id', userId);
              await supabase.from('template_fields').delete().eq('collection_id', itemId).eq('user_id', userId);
              await supabase.from('collections').delete().eq('id', itemId).eq('user_id', userId);
              await supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId);
            });
            return; // skip the deleteBinItem call below — handled above
          } else if (binItem._type === 'cardDef') {
            // Delete inventory items and slots by card_def_id FK directly
            // (not from local state — those items were removed on soft delete)
            getRealUserId().then(async userId => {
              if (!userId) return;
              await supabase.from('user_inventory').delete().eq('card_def_id', itemId).eq('user_id', userId);
              await supabase.from('binder_slots').delete().eq('card_def_id', itemId).eq('user_id', userId);
              await supabase.from('card_definitions').delete().eq('id', itemId).eq('user_id', userId);
              await supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId);
            });
            return; // skip the deleteBinItem call below — handled above
          }
        }
        deleteBinItem(itemId);
        break;
      }
      case ACTIONS.BIN_EMPTY: {
        getRealUserId().then(userId => { if (userId) emptyBin(userId); });
        break;
      }

      default:
        break;
    }
  }

  return {
    getState() { return state; },

    dispatch(action) {
      if (process.env.NODE_ENV !== 'production') {
        DEBUG && console.debug('[Store] dispatch', action.type, action.payload ?? '');
      }

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

        // 2. Sync to Supabase (fire-and-forget, non-blocking)
        syncToSupabase(action, nextState, prevState);
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