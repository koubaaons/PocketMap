/**
 * @fileoverview binSync — Supabase sync for the bin domain.
 *
 * Split out of the monolithic supabaseSync.js (was a single ~850-
 * line, 39-case switch statement) for scalability, matching the same
 * domain split done for the reducer itself (store/reducers/). Each
 * function here has the same shape the original switch cases did:
 * push zero or more pending write promises onto the shared `pending`
 * array passed in — nothing is returned, since the root
 * supabaseSync.js awaits everything collected across every domain
 * together at the end via Promise.allSettled.
 */

import { ACTIONS } from '../../actionTypes.js';
import { supabase } from '../../../services/supabase.js';
import { getStoragePathFromUrl, deleteImageFromStorage } from '../../../utils/supabaseImageUpload.js';
import { getRealUserId, logIfError, deleteBinItem, emptyBin } from './syncHelpers.js';

export function binSync(action, nextState, prevState, pending) {
  switch (action.type) {

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
    case ACTIONS.BIN_RESTORE_INSERT: {
      const { itemId: insertId } = action.payload ?? {};
      if (insertId) {
        pending.push(
          supabase.from('binder_inserts').update({ deleted_at: null }).eq('id', insertId)
            .then(({ error }) => { if (error) console.error('[Sync] insert restore failed:', error); })
        );
        pending.push(deleteBinItem(insertId));
      }
      break;
    }

    // === Quantity tracking: restore a single removed copy ===
    // === REMOVED: BIN_RESTORE_INVENTORY_ITEM sync — unreachable now,
    // matching the reducer's reversion. ===
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
            const { data: cds } = await supabase.from('card_definitions').select('id, image_url, image_size_bytes').eq('collection_id', itemId).eq('user_id', userId);
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
        } else if (binItem._type === 'insert') {
          // insertId on any panel was already cleared to null when
          // this image was soft-deleted (see reducer.js's
          // BINDER_INSERT_DELETE) — nothing left to cascade there,
          // just the insert row itself, its bin entry, and its
          // stored image.
          pending.push(getRealUserId().then(async userId => {
            if (!userId) return;
            await logIfError(supabase.from('binder_inserts').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: binder_inserts ${itemId}`);
            await logIfError(supabase.from('bin').delete().eq('id', itemId).eq('user_id', userId), `permanent delete: bin row for insert ${itemId}`);
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
}
