/**
 * @fileoverview Supabase write router — all per-entity write operations.
 *
 * Extracted from store/index.js (Issue #123 pre-M12 refactor) so that
 * adding new entity types in Milestone 12 (Pokémon sets, Yu-Gi-Oh, etc.)
 * only touches this file, not the store itself.
 *
 * Every write is still fire-and-forget as far as the UI is concerned —
 * Supabase calls are not awaited before the UI updates, so nothing ever
 * blocks a re-render. BUT syncToSupabase now returns a Promise that
 * resolves once every write IT kicked off has actually settled, and
 * store/index.js tracks that promise so anything else (specifically,
 * useSupabaseSync.js's realtime handler) can wait for pending writes
 * to finish before doing anything that depends on the database being
 * caught up.
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
import { getStoragePathFromUrl, deleteImageFromStorage } from '../utils/supabaseImageUpload.js';

// ── Auth helper ───────────────────────────────────────────────────────────────
let cachedUserId = null;

supabase.auth.getSession().then(({ data: { session } }) => {
  cachedUserId = session?.user?.id ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

async function getRealUserId() {
  if (cachedUserId) return cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  cachedUserId = user?.id ?? null;

  if (!cachedUserId) {
    console.error(
      '[Sync] getRealUserId resolved to null — a write is about to be ' +
      'silently skipped even though the local UI already updated. Is the ' +
      'session actually valid right now?'
    );
  }

  return cachedUserId;
}

async function logIfError(promise, context) {
  const { error } = await promise;
  if (error) console.error(`[Sync] ${context} failed:`, error);
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

function upsertBinder(binder) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binders').upsert({ ...binderToRow(binder), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder upsert failed:', error); })
      .catch(err => console.error('[Sync] binder upsert error:', err));
  });
}

function upsertCollection(collection) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('collections').upsert({ ...collectionToRow(collection), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] collection upsert failed:', error); })
      .catch(err => console.error('[Sync] collection upsert error:', err));
  });
}

function upsertTemplateField(field) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('template_fields').upsert({ ...templateFieldToRow(field), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] template field upsert failed:', error); })
      .catch(err => console.error('[Sync] template field upsert error:', err));
  });
}

function upsertCardDefinition(cd) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('card_definitions').upsert({ ...cardDefinitionToRow(cd), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] card definition upsert failed:', error); })
      .catch(err => console.error('[Sync] card definition upsert error:', err));
  });
}

function upsertInventoryItem(item) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('user_inventory').upsert({ ...inventoryItemToRow(item), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] inventory upsert failed:', error); })
      .catch(err => console.error('[Sync] inventory upsert error:', err));
  });
}

function upsertBinderSlot(slot) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binder_slots').upsert({ ...binderSlotToRow(slot), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder slot upsert failed:', error); })
      .catch(err => console.error('[Sync] binder slot upsert error:', err));
  });
}

function upsertBinItem(item, entityType) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('bin').upsert({
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

function deleteCollection(collectionId) {
  return supabase.from('collections').delete().eq('id', collectionId)
    .then(({ error }) => { if (error) console.error('[Sync] collection delete failed:', error); })
    .catch(err => console.error('[Sync] collection delete error:', err));
}

function deleteTemplateField(fieldId) {
  return supabase.from('template_fields').delete().eq('id', fieldId)
    .then(({ error }) => { if (error) console.error('[Sync] template field delete failed:', error); })
    .catch(err => console.error('[Sync] template field delete error:', err));
}

function deleteCardDefinition(cardDefId) {
  return supabase.from('card_definitions').delete().eq('id', cardDefId)
    .then(({ error }) => { if (error) console.error('[Sync] card definition delete failed:', error); })
    .catch(err => console.error('[Sync] card definition delete error:', err));
}

function deleteInventoryItem(itemId) {
  return supabase.from('user_inventory').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Sync] inventory delete failed:', error); })
    .catch(err => console.error('[Sync] inventory delete error:', err));
}

function deleteBinderSlot(slotId) {
  return supabase.from('binder_slots').delete().eq('id', slotId)
    .then(({ error }) => { if (error) console.error('[Sync] binder slot delete failed:', error); })
    .catch(err => console.error('[Sync] binder slot delete error:', err));
}

function deleteBinItem(itemId) {
  return supabase.from('bin').delete().eq('id', itemId)
    .then(({ error }) => { if (error) console.error('[Sync] bin delete failed:', error); })
    .catch(err => console.error('[Sync] bin delete error:', err));
}

// === FIX (real, confirmed bug): emptyBin only ever deleted rows from
// the bin table itself — it never touched the underlying binders/
// collections/card_definitions rows those bin entries point to, nor
// their own cascades (binder_slots, user_inventory, template_fields)
// or storage files. Every "Empty Trash" ever clicked left every item
// in it as a permanent ghost: gone from the bin table (so the Trash
// Bin UI correctly showed empty), but still sitting in its real table
// forever, soft-deleted and invisible to the rest of the app. This
// now cascades each item exactly the same way BIN_DELETE_ITEM already
// does for a single item — just looped over everything in the bin.
async function emptyBin(userId, binItems) {
  for (const binItem of binItems) {
    try {
      if (binItem._type === 'binder') {
        await logIfError(supabase.from('binder_slots').delete().eq('binder_id', binItem.id).eq('user_id', userId), `empty bin: binder_slots for binder ${binItem.id}`);
        await logIfError(supabase.from('binders').delete().eq('id', binItem.id).eq('user_id', userId), `empty bin: binder ${binItem.id}`);
        for (const sticker of binItem.stickers ?? []) {
          await deleteImageFromStorage(getStoragePathFromUrl(sticker.image_url));
        }
      } else if (binItem._type === 'collection') {
        const { data: cds } = await supabase.from('card_definitions').select('id, image_url').eq('collection_id', binItem.id).eq('user_id', userId);
        if (cds?.length) {
          const cdIds = cds.map(c => c.id);
          await logIfError(supabase.from('user_inventory').delete().in('card_def_id', cdIds).eq('user_id', userId), `empty bin: inventory for collection ${binItem.id}`);
          await logIfError(supabase.from('binder_slots').delete().in('card_def_id', cdIds).eq('user_id', userId), `empty bin: binder_slots for collection ${binItem.id}`);
          for (const cd of cds) {
            await deleteImageFromStorage(getStoragePathFromUrl(cd.image_url));
          }
        }
        await logIfError(supabase.from('card_definitions').delete().eq('collection_id', binItem.id).eq('user_id', userId), `empty bin: card_definitions for collection ${binItem.id}`);
        await logIfError(supabase.from('template_fields').delete().eq('collection_id', binItem.id).eq('user_id', userId), `empty bin: template_fields for collection ${binItem.id}`);
        await logIfError(supabase.from('collections').delete().eq('id', binItem.id).eq('user_id', userId), `empty bin: collection ${binItem.id}`);
      } else if (binItem._type === 'cardDef') {
        await logIfError(supabase.from('user_inventory').delete().eq('card_def_id', binItem.id).eq('user_id', userId), `empty bin: inventory for card ${binItem.id}`);
        await logIfError(supabase.from('binder_slots').delete().eq('card_def_id', binItem.id).eq('user_id', userId), `empty bin: binder_slots for card ${binItem.id}`);
        await logIfError(supabase.from('card_definitions').delete().eq('id', binItem.id).eq('user_id', userId), `empty bin: card_definitions ${binItem.id}`);
        await deleteImageFromStorage(getStoragePathFromUrl(binItem.image_url));
      } else {
        console.error('[Sync] empty bin: unknown _type for bin item, skipping cascade:', binItem);
      }
    } catch (err) {
      console.error(`[Sync] empty bin: cascade failed for item ${binItem.id}:`, err);
    }
  }

  return logIfError(supabase.from('bin').delete().eq('user_id', userId), 'empty bin: clearing bin table');
}

export function syncToSupabase(action, nextState, prevState) {
  const pending = [];

  switch (action.type) {

    case ACTIONS.BINDER_ADD:
    case ACTIONS.BINDER_UPDATE:
    case ACTIONS.BINDER_ADD_PAGE: {
      const binder = nextState.binders.find(
        b => b.id === (action.payload.id ?? action.payload.binderId)
      );
      if (binder) {
        pending.push(upsertBinder(binder));
        const prevBinder = prevState.binders.find(b => b.id === binder.id);
        const prevUrls = new Set((prevBinder?.stickers ?? []).map(s => s.image_url));
        const nextUrls = new Set((binder.stickers ?? []).map(s => s.image_url));
        for (const url of prevUrls) {
          if (!nextUrls.has(url)) {
            pending.push(deleteImageFromStorage(getStoragePathFromUrl(url)));
          }
        }
      }
      break;
    }
    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload ?? {};
      if (binderId) {
        pending.push(
          supabase.from('binders')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', binderId)
            .then(({ error }) => { if (error) console.error('[Sync] binder soft delete failed:', error); })
        );
        const binItem = nextState.bin.find(b => b.id === binderId);
        if (binItem) pending.push(upsertBinItem(binItem, 'binder'));
      }
      break;
    }

    case ACTIONS.COLLECTION_ADD:
    case ACTIONS.COLLECTION_UPDATE: {
      const col = nextState.collections.find(c => c.id === action.payload.id);
      if (col) pending.push(upsertCollection(col));
      break;
    }
    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload ?? {};
      if (collectionId) {
        const now = new Date().toISOString();
        pending.push(getRealUserId().then(async userId => {
          if (!userId) return;
          await supabase.from('collections').update({ deleted_at: now }).eq('id', collectionId).eq('user_id', userId);
          const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', collectionId).eq('user_id', userId);
          if (cds?.length) {
            const cdIds = cds.map(c => c.id);
            await supabase.from('card_definitions').update({ deleted_at: now }).in('id', cdIds).eq('user_id', userId);
            await supabase.from('user_inventory').update({ deleted_at: now }).in('card_def_id', cdIds).eq('user_id', userId);
          }
        }));
        const binItem = nextState.bin.find(b => b.id === collectionId);
        if (binItem) pending.push(upsertBinItem(binItem, 'collection'));
      }
      break;
    }

    case ACTIONS.TEMPLATE_FIELD_ADD:
    case ACTIONS.TEMPLATE_FIELD_UPDATE: {
      const field = nextState.templateFields.find(f => f.id === action.payload.id);
      if (field) pending.push(upsertTemplateField(field));
      break;
    }
    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      (action.payload ?? []).forEach(f => {
        const field = nextState.templateFields.find(tf => tf.id === f.id);
        if (field) pending.push(upsertTemplateField(field));
      });
      break;
    }
    case ACTIONS.TEMPLATE_FIELD_REORDER: {
      nextState.templateFields
        .filter(f => f.collectionId === action.payload?.collectionId)
        .forEach(f => pending.push(upsertTemplateField(f)));
      break;
    }

    case ACTIONS.CARD_DEFINITION_ADD:
    case ACTIONS.CARD_DEFINITION_UPDATE: {
      const cd = nextState.cardDefinitions.find(c => c.id === action.payload.id);
      if (cd) pending.push(upsertCardDefinition(cd));
      break;
    }
    case ACTIONS.CARD_DEFINITION_BULK_ADD: {
      // === FIX (real bug: bulk imports silently losing roughly half
      // their cards): this used to fire every card's upsert via
      // .forEach with no sequencing at all — a burst of 30+ writes
      // hitting Supabase essentially simultaneously. That's exactly
      // the kind of load that can silently drop some writes (a
      // connection-pool limit, a rate limit, a timeout under
      // concurrent load) — and there was no way to notice, since
      // local state already shows all the cards regardless of
      // whether their individual database write actually landed.
      // Sequential writes (one at a time, not fire-and-forget in a
      // loop) are slower for a large import but far more reliable —
      // matches the same reasoning already used for the Pokémon API's
      // own fetch pagination (sequential, not parallel, to respect
      // its rate limit). Wrapped in an IIFE so this case can await
      // inside a switch without restructuring the whole function.
      const cardsToUpsert = (action.payload ?? [])
        .map(c => nextState.cardDefinitions.find(d => d.id === c.id))
        .filter(Boolean);
      pending.push((async () => {
        for (const cd of cardsToUpsert) {
          await upsertCardDefinition(cd);
        }
      })());
      break;
    }
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload ?? {};
      if (cardDefId) {
        const now = new Date().toISOString();
        pending.push(
          supabase.from('card_definitions').update({ deleted_at: now }).eq('id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Sync] card soft delete failed:', error); })
        );
        pending.push(
          supabase.from('user_inventory').update({ deleted_at: now }).eq('card_def_id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Sync] inventory soft delete failed:', error); })
        );
        const binItem = nextState.bin.find(b => b.id === cardDefId);
        if (binItem) pending.push(upsertBinItem(binItem, 'cardDef'));
      }
      break;
    }

    case ACTIONS.INVENTORY_ADD:
    case ACTIONS.INVENTORY_UPDATE: {
      const item = nextState.inventory.find(i => i.id === action.payload.id);
      if (item) pending.push(upsertInventoryItem(item));
      break;
    }
    case ACTIONS.INVENTORY_DELETE: {
      if (action.payload?.inventoryId) pending.push(deleteInventoryItem(action.payload.inventoryId));
      break;
    }

    case ACTIONS.BINDER_SLOT_ADD: {
      const slot = nextState.binderSlots.find(s => s.id === action.payload?.slot?.id);
      if (slot) pending.push(upsertBinderSlot(slot));
      break;
    }
    case ACTIONS.BINDER_SLOT_MOVE: {
      const slot = nextState.binderSlots.find(s => s.id === action.payload?.slotId);
      if (slot) pending.push(upsertBinderSlot(slot));
      break;
    }
    case ACTIONS.BINDER_SLOT_REMOVE: {
      if (action.payload?.slotId) pending.push(deleteBinderSlot(action.payload.slotId));
      break;
    }

    case ACTIONS.BIN_RESTORE_BINDER: {
      const { itemId: binderId } = action.payload ?? {};
      if (binderId) {
        pending.push(
          supabase.from('binders').update({ deleted_at: null }).eq('id', binderId)
            .then(({ error }) => { if (error) console.error('[Sync] binder restore failed:', error); })
        );
        pending.push(deleteBinItem(binderId));
      }
      break;
    }
    case ACTIONS.BIN_RESTORE_COLLECTION: {
      const { itemId: colId } = action.payload ?? {};
      if (colId) {
        pending.push(getRealUserId().then(async userId => {
          if (!userId) return;
          await supabase.from('collections').update({ deleted_at: null }).eq('id', colId).eq('user_id', userId);
          const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', colId).eq('user_id', userId);
          if (cds?.length) {
            const cdIds = cds.map(c => c.id);
            await supabase.from('card_definitions').update({ deleted_at: null }).in('id', cdIds).eq('user_id', userId);
            await supabase.from('user_inventory').update({ deleted_at: null }).in('card_def_id', cdIds).eq('user_id', userId);
          }
        }));
        pending.push(deleteBinItem(colId));
      }
      break;
    }
    case ACTIONS.BIN_RESTORE_CARD: {
      const { itemId: cardId } = action.payload ?? {};
      if (cardId) {
        pending.push(
          supabase.from('card_definitions').update({ deleted_at: null }).eq('id', cardId)
            .then(({ error }) => { if (error) console.error('[Sync] card restore failed:', error); })
        );
        pending.push(
          supabase.from('user_inventory').update({ deleted_at: null }).eq('card_def_id', cardId)
            .then(({ error }) => { if (error) console.error('[Sync] inventory restore failed:', error); })
        );
        pending.push(deleteBinItem(cardId));
      }
      break;
    }
    case ACTIONS.BIN_DELETE_ITEM: {
      const { itemId } = action.payload ?? {};
      if (!itemId) break;
      const binItem = prevState.bin.find(b => b.id === itemId);
      if (binItem) {
        if (binItem._type === 'binder') {
          pending.push(getRealUserId().then(async userId => {
            if (!userId) return;
            await logIfError(supabase.from('binder_slots').delete().eq('binder_id', itemId).eq('user_id', userId), 'binder_slots delete (permanent binder delete)');

            // === DIAGNOSTIC: .select() makes Supabase return the rows
            // it actually deleted. If RLS's USING clause doesn't match
            // this row for any reason, the delete "succeeds" (no
            // error) but affects zero rows — silently. Checking only
            // for {error} would never catch that. This logs exactly
            // what happened so we can tell "didn't run" apart from
            // "ran but blocked" apart from "ran and worked". ===
            const { data: deletedRows, error: binderDeleteError } = await supabase
              .from('binders').delete().eq('id', itemId).eq('user_id', userId).select();
            if (binderDeleteError) {
              console.error('[Sync] binders delete (permanent) failed:', binderDeleteError);
            } else {
              console.log('[Sync] binders delete (permanent) — userId:', userId, 'itemId:', itemId, 'affected rows:', deletedRows);
            }

            await logIfError(supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId), 'bin row delete (permanent binder delete)');
            for (const sticker of binItem.stickers ?? []) {
              await deleteImageFromStorage(getStoragePathFromUrl(sticker.image_url));
            }
          }));
          break;
        } else if (binItem._type === 'collection') {
          pending.push(getRealUserId().then(async userId => {
            if (!userId) return;
            const { data: cds } = await supabase.from('card_definitions').select('id, image_url').eq('collection_id', itemId).eq('user_id', userId);
            if (cds?.length) {
              const cdIds = cds.map(c => c.id);
              await logIfError(supabase.from('user_inventory').delete().in('card_def_id', cdIds).eq('user_id', userId), `permanent delete: inventory for collection ${itemId}`);
              await logIfError(supabase.from('binder_slots').delete().in('card_def_id', cdIds).eq('user_id', userId), `permanent delete: binder_slots for collection ${itemId}`);
              for (const cd of cds) {
                await deleteImageFromStorage(getStoragePathFromUrl(cd.image_url));
              }
            }
            await logIfError(supabase.from('card_definitions').delete().eq('collection_id', itemId).eq('user_id', userId), `permanent delete: card_definitions for collection ${itemId}`);
            await logIfError(supabase.from('template_fields').delete().eq('collection_id', itemId).eq('user_id', userId), `permanent delete: template_fields for collection ${itemId}`);
            await logIfError(supabase.from('collections').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: collection ${itemId}`);
            await logIfError(supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: bin row for collection ${itemId}`);
          }));
          break;
        } else if (binItem._type === 'cardDef') {
          pending.push(getRealUserId().then(async userId => {
            if (!userId) return;
            await logIfError(supabase.from('user_inventory').delete().eq('card_def_id', itemId).eq('user_id', userId), `permanent delete: inventory for card ${itemId}`);
            await logIfError(supabase.from('binder_slots').delete().eq('card_def_id', itemId).eq('user_id', userId), `permanent delete: binder_slots for card ${itemId}`);
            await logIfError(supabase.from('card_definitions').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: card_definitions ${itemId}`);
            await logIfError(supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: bin row for card ${itemId}`);
            await deleteImageFromStorage(getStoragePathFromUrl(binItem.image_url));
          }));
          break;
        }
      } else {
        // === DIAGNOSTIC: if binItem is undefined here, prevState.bin
        // didn't have this itemId at all — meaning the code falls
        // through to the generic deleteBinItem(itemId) below, which
        // ONLY removes the bin table row and NEVER touches binders/
        // card_definitions/collections. This would exactly explain a
        // permanently-deleted binder staying in the binders table
        // forever: this whole cascade block never even runs. ===
        console.error('[Sync] BIN_DELETE_ITEM: no matching binItem found in prevState.bin for itemId', itemId, '— falling through to generic bin-only delete, which will NOT remove the underlying binders/card_definitions/collections row.');
      }
      pending.push(deleteBinItem(itemId));
      break;
    }
    case ACTIONS.BIN_EMPTY: {
      pending.push(getRealUserId().then(userId => {
        if (userId) return emptyBin(userId, prevState.bin);
      }));
      break;
    }

    default:
      break;
  }

  return Promise.allSettled(pending);
}