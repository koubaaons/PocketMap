/**
 * @fileoverview syncHelpers — shared, low-level Supabase write
 * helpers used across every domain sync file in store/reducers/sync/.
 *
 * Split out of the monolithic supabaseSync.js (was a single ~850-
 * line, 39-case switch statement) for scalability, matching the same
 * domain split done for the reducer itself. These helpers are
 * genuinely cross-cutting — upsertBinItem/deleteBinItem/emptyBin in
 * particular are used by several different domains' delete cascades,
 * not just the Bin/Trash domain — so they live in one shared file
 * instead of being duplicated or awkwardly cross-imported between
 * domain files.
 */

import {
  binderToRow,
  binderSlotToRow,
  binderInsertToRow,
  binderPanelToRow,
  collectionToRow,
  templateFieldToRow,
  cardDefinitionToRow,
  inventoryItemToRow,
} from '../../supabaseStorage.js';
import { supabase } from '../../../services/supabase.js';
import { getStoragePathFromUrl, deleteImageFromStorage } from '../../../utils/supabaseImageUpload.js';

// ── Auth helper ───────────────────────────────────────────────────────────────
let cachedUserId = null;

supabase.auth.getSession().then(({ data: { session } }) => {
  cachedUserId = session?.user?.id ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});

export async function getRealUserId() {
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

export async function logIfError(promise, context) {
  const { error } = await promise;
  if (error) console.error(`[Sync] ${context} failed:`, error);
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

export function upsertBinder(binder) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binders').upsert({ ...binderToRow(binder), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder upsert failed:', error); })
      .catch(err => console.error('[Sync] binder upsert error:', err));
  });
}

export function upsertCollection(collection) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('collections').upsert({ ...collectionToRow(collection), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] collection upsert failed:', error); })
      .catch(err => console.error('[Sync] collection upsert error:', err));
  });
}

export function upsertTemplateField(field) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('template_fields').upsert({ ...templateFieldToRow(field), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] template field upsert failed:', error); })
      .catch(err => console.error('[Sync] template field upsert error:', err));
  });
}

export function upsertCardDefinition(cd) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('card_definitions').upsert({ ...cardDefinitionToRow(cd), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] card definition upsert failed:', error); })
      .catch(err => console.error('[Sync] card definition upsert error:', err));
  });
}

export function upsertInventoryItem(item) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('user_inventory').upsert({ ...inventoryItemToRow(item), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] inventory upsert failed:', error); })
      .catch(err => console.error('[Sync] inventory upsert error:', err));
  });
}

export function upsertBinderSlot(slot) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binder_slots').upsert({ ...binderSlotToRow(slot), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder slot upsert failed:', error); })
      .catch(err => console.error('[Sync] binder slot upsert error:', err));
  });
}

// === Michi Method support: combined slots ===
export function upsertBinderInsert(insert) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binder_inserts').upsert({ ...binderInsertToRow(insert), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder insert upsert failed:', error); })
      .catch(err => console.error('[Sync] binder insert upsert error:', err));
  });
}

export function upsertBinderPanel(panel) {
  return getRealUserId().then(userId => {
    if (!userId) return;
    return supabase.from('binder_panels').upsert({ ...binderPanelToRow(panel), user_id: userId })
      .then(({ error }) => { if (error) console.error('[Sync] binder panel upsert failed:', error); })
      .catch(err => console.error('[Sync] binder panel upsert error:', err));
  });
}

export function upsertBinItem(item, entityType) {
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

export function deleteBinderSlot(slotId) {
  return supabase.from('binder_slots').delete().eq('id', slotId)
    .then(({ error }) => { if (error) console.error('[Sync] binder slot delete failed:', error); })
    .catch(err => console.error('[Sync] binder slot delete error:', err));
}

export function deleteBinderPanel(panelId) {
  return supabase.from('binder_panels').delete().eq('id', panelId)
    .then(({ error }) => { if (error) console.error('[Sync] binder panel delete failed:', error); })
    .catch(err => console.error('[Sync] binder panel delete error:', err));
}

export function deleteBinItem(itemId) {
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
export async function emptyBin(userId, binItems) {
  for (const binItem of binItems) {
    try {
      if (binItem._type === 'binder') {
        await logIfError(supabase.from('binder_slots').delete().eq('binder_id', binItem.id).eq('user_id', userId), `empty bin: binder_slots for binder ${binItem.id}`);
        await logIfError(supabase.from('binders').delete().eq('id', binItem.id).eq('user_id', userId), `empty bin: binder ${binItem.id}`);
        for (const sticker of binItem.stickers ?? []) {
          await deleteImageFromStorage(getStoragePathFromUrl(sticker.image_url));
        }
      } else if (binItem._type === 'collection') {
        const { data: cds } = await supabase.from('card_definitions').select('id, image_url, image_size_bytes').eq('collection_id', binItem.id).eq('user_id', userId);
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
      } else if (binItem._type === 'insert') {
        await logIfError(supabase.from('binder_inserts').delete().eq('id', binItem.id).eq('user_id', userId), `empty bin: binder_inserts ${binItem.id}`);
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

