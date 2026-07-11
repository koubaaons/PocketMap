/**
 * @fileoverview Supabase write router — all per-entity write operations.
 *
 * Extracted from store/index.js (Issue #123 pre-M12 refactor) so that
 * adding new entity types in Milestone 12 (Pokémon sets, Yu-Gi-Oh, etc.)
 * only touches this file, not the store itself.
 *
 * Every write is fire-and-forget — Supabase calls are not awaited so they
 * never block the UI. Local state updates and re-renders happen immediately.
 * Full error recovery and retry logic are Milestone 20 concerns.
 *
 * Exports a single function: syncToSupabase(action, nextState, prevState)
 * Called by store/index.js after every persisted action.
 */

import { ACTIONS } from './reducer.js';
import {
  binderToRow,
  binderSlotToRow,
  collectionToRow,
  templateFieldToRow,
  cardDefinitionToRow,
  inventoryItemToRow,
} from './supabaseStorage.js';
import { supabase } from '../services/supabase.js';

// ── Auth helper ───────────────────────────────────────────────────────────────
// Never trust the userId stored on entities — old data may carry 'local-user-1'.

async function getRealUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

function upsertBinder(binder) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('binders').upsert({ ...binderToRow(binder), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder upsert failed:', error); })
      .catch(err => console.error('[Sync] binder upsert error:', err));
  });
}

function upsertCollection(collection) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('collections').upsert({ ...collectionToRow(collection), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] collection upsert failed:', error); })
      .catch(err => console.error('[Sync] collection upsert error:', err));
  });
}

function upsertTemplateField(field) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('template_fields').upsert({ ...templateFieldToRow(field), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] template field upsert failed:', error); })
      .catch(err => console.error('[Sync] template field upsert error:', err));
  });
}

function upsertCardDefinition(cd) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('card_definitions').upsert({ ...cardDefinitionToRow(cd), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] card definition upsert failed:', error); })
      .catch(err => console.error('[Sync] card definition upsert error:', err));
  });
}

function upsertInventoryItem(item) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('user_inventory').upsert({ ...inventoryItemToRow(item), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] inventory upsert failed:', error); })
      .catch(err => console.error('[Sync] inventory upsert error:', err));
  });
}

function upsertBinderSlot(slot) {
  getRealUserId().then(userId => {
    if (!userId) return;
    supabase.from('binder_slots').upsert({ ...binderSlotToRow(slot), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder slot upsert failed:', error); })
      .catch(err => console.error('[Sync] binder slot upsert error:', err));
  });
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
      .then(({ error }) => { if (error) console.error('[Sync] bin upsert failed:', error); })
      .catch(err => console.error('[Sync] bin upsert error:', err));
  });
}

// ── Delete helpers ────────────────────────────────────────────────────────────

function deleteBinder(binderId) {
  supabase.from('binders').delete().eq('id', binderId)
    .then(({ error }) => { if (error) console.error('[Sync] binder delete failed:', error); })
    .catch(err => console.error('[Sync] binder delete error:', err));
}

function deleteCollection(collectionId) {
  supabase.from('collections').delete().eq('id', collectionId)
    .then(({ error }) => { if (error) console.error('[Sync] collection delete failed:', error); })
    .catch(err => console.error('[Sync] collection delete error:', err));
}

function deleteTemplateField(fieldId) {
  supabase.from('template_fields').delete().eq('id', fieldId)
    .then(({ error }) => { if (error) console.error('[Sync] template field delete failed:', error); })
    .catch(err => console.error('[Sync] template field delete error:', err));
}

function deleteCardDefinition(cardDefId) {
  supabase.from('card_definitions').delete().eq('id', cardDefId)
    .then(({ error }) => { if (error) console.error('[Sync] card definition delete failed:', error); })
    .catch(err => console.error('[Sync] card definition delete error:', err));
}

function deleteInventoryItem(itemId) {
  supabase.from('user_inventory').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Sync] inventory delete failed:', error); })
    .catch(err => console.error('[Sync] inventory delete error:', err));
}

function deleteBinderSlot(slotId) {
  supabase.from('binder_slots').delete().eq('id', slotId)
    .then(({ error }) => { if (error) console.error('[Sync] binder slot delete failed:', error); })
    .catch(err => console.error('[Sync] binder slot delete error:', err));
}

function deleteBinItem(itemId) {
  supabase.from('bin').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Sync] bin delete failed:', error); })
    .catch(err => console.error('[Sync] bin delete error:', err));
}

function emptyBin(userId) {
  supabase.from('bin').delete().eq('user_id', userId)
    .then(({ error }) => { if (error) console.error('[Sync] bin empty failed:', error); })
    .catch(err => console.error('[Sync] bin empty error:', err));
}

// ── Router ────────────────────────────────────────────────────────────────────
// Called by store/index.js after every persisted action.
// nextState = post-reducer state, prevState = pre-reducer state.
// prevState is needed for BIN_DELETE_ITEM to read the bin item's _type
// before the reducer removed it from state.bin.

export function syncToSupabase(action, nextState, prevState) {
  switch (action.type) {

    // ── Binders ────────────────────────────────────────────────────────────────
    case ACTIONS.BINDER_ADD:
    case ACTIONS.BINDER_UPDATE:
    case ACTIONS.BINDER_ADD_PAGE: {
      const binder = nextState.binders.find(
        b => b.id === (action.payload.id ?? action.payload.binderId)
      );
      if (binder) upsertBinder(binder);
      break;
    }
    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload ?? {};
      if (binderId) {
        supabase.from('binders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', binderId)
          .then(({ error }) => { if (error) console.error('[Sync] binder soft delete failed:', error); });
        const binItem = nextState.bin.find(b => b.id === binderId);
        if (binItem) upsertBinItem(binItem, 'binder');
      }
      break;
    }

    // ── Collections ────────────────────────────────────────────────────────────
    case ACTIONS.COLLECTION_ADD:
    case ACTIONS.COLLECTION_UPDATE: {
      const col = nextState.collections.find(c => c.id === action.payload.id);
      if (col) upsertCollection(col);
      break;
    }
    case ACTIONS.COLLECTION_DELETE: {
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

    // ── Template fields ────────────────────────────────────────────────────────
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

    // ── Card definitions ───────────────────────────────────────────────────────
    case ACTIONS.CARD_DEFINITION_ADD:
    case ACTIONS.CARD_DEFINITION_UPDATE: {
      const cd = nextState.cardDefinitions.find(c => c.id === action.payload.id);
      if (cd) upsertCardDefinition(cd);
      break;
    }
    case ACTIONS.CARD_DEFINITION_BULK_ADD: {
      // Milestone 12: bulk import from APIs — upsert all in parallel
      (action.payload ?? []).forEach(c => {
        const cd = nextState.cardDefinitions.find(d => d.id === c.id);
        if (cd) upsertCardDefinition(cd);
      });
      break;
    }
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload ?? {};
      if (cardDefId) {
        const now = new Date().toISOString();
        supabase.from('card_definitions').update({ deleted_at: now }).eq('id', cardDefId)
          .then(({ error }) => { if (error) console.error('[Sync] card soft delete failed:', error); });
        supabase.from('user_inventory').update({ deleted_at: now }).eq('card_def_id', cardDefId)
          .then(({ error }) => { if (error) console.error('[Sync] inventory soft delete failed:', error); });
        const binItem = nextState.bin.find(b => b.id === cardDefId);
        if (binItem) upsertBinItem(binItem, 'cardDef');
      }
      break;
    }

    // ── Inventory ──────────────────────────────────────────────────────────────
    case ACTIONS.INVENTORY_ADD:
    case ACTIONS.INVENTORY_UPDATE: {
      const item = nextState.inventory.find(i => i.id === action.payload.id);
      if (item) upsertInventoryItem(item);
      break;
    }
    case ACTIONS.INVENTORY_DELETE: {
      if (action.payload?.inventoryId) deleteInventoryItem(action.payload.inventoryId);
      break;
    }

    // ── Binder slots ───────────────────────────────────────────────────────────
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

    // ── Bin ────────────────────────────────────────────────────────────────────
    case ACTIONS.BIN_RESTORE_BINDER: {
      const { itemId: binderId } = action.payload ?? {};
      if (binderId) {
        supabase.from('binders').update({ deleted_at: null }).eq('id', binderId)
          .then(({ error }) => { if (error) console.error('[Sync] binder restore failed:', error); });
        deleteBinItem(binderId);
      }
      break;
    }
    case ACTIONS.BIN_RESTORE_COLLECTION: {
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
      const { itemId: cardId } = action.payload ?? {};
      if (cardId) {
        supabase.from('card_definitions').update({ deleted_at: null }).eq('id', cardId)
          .then(({ error }) => { if (error) console.error('[Sync] card restore failed:', error); });
        supabase.from('user_inventory').update({ deleted_at: null }).eq('card_def_id', cardId)
          .then(({ error }) => { if (error) console.error('[Sync] inventory restore failed:', error); });
        deleteBinItem(cardId);
      }
      break;
    }
    case ACTIONS.BIN_DELETE_ITEM: {
      const { itemId } = action.payload ?? {};
      if (!itemId) break;
      // Use prevState.bin — the reducer already removed the item from nextState.bin
      const binItem = prevState.bin.find(b => b.id === itemId);
      if (binItem) {
        if (binItem._type === 'binder') {
          deleteBinder(itemId);
        } else if (binItem._type === 'collection') {
          getRealUserId().then(async userId => {
            if (!userId) return;
            const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', itemId).eq('user_id', userId);
            if (cds?.length) {
              const cdIds = cds.map(c => c.id);
              await supabase.from('user_inventory').delete().in('card_def_id', cdIds).eq('user_id', userId);
              await supabase.from('binder_slots').delete().in('card_def_id', cdIds).eq('user_id', userId);
            }
            await supabase.from('card_definitions').delete().eq('collection_id', itemId).eq('user_id', userId);
            await supabase.from('template_fields').delete().eq('collection_id', itemId).eq('user_id', userId);
            await supabase.from('collections').delete().eq('id', itemId).eq('user_id', userId);
            await supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId);
          });
          return;
        } else if (binItem._type === 'cardDef') {
          getRealUserId().then(async userId => {
            if (!userId) return;
            await supabase.from('user_inventory').delete().eq('card_def_id', itemId).eq('user_id', userId);
            await supabase.from('binder_slots').delete().eq('card_def_id', itemId).eq('user_id', userId);
            await supabase.from('card_definitions').delete().eq('id', itemId).eq('user_id', userId);
            await supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId);
          });
          return;
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