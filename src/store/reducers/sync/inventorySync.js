/**
 * @fileoverview inventorySync — Supabase sync for the inventory domain.
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
import { upsertInventoryItem } from './syncHelpers.js';

export function inventorySync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.INVENTORY_ADD: {
      const item = nextState.inventory.find(i => i.id === action.payload.id);
      if (item) pending.push(upsertInventoryItem(item));

      // === Fixes the real "disconnected from binders" bug — the
      // reducer may have auto-linked an existing, unowned placeholder
      // slot/panel to this newly-added copy (see reducer.js's
      // INVENTORY_ADD case). Diffing prevState/nextState is how the
      // sync layer finds out whether that happened and, if so, which
      // one, since the action payload itself only ever mentions the
      // new inventory item.
      const newlyLinkedSlot = nextState.binderSlots.find(s => {
        const prev = prevState.binderSlots.find(ps => ps.id === s.id);
        return prev && !prev.inventoryItemId && s.inventoryItemId === item?.id;
      });
      if (newlyLinkedSlot) {
        pending.push(
          supabase.from('binder_slots').update({ inventory_item_id: newlyLinkedSlot.inventoryItemId }).eq('id', newlyLinkedSlot.id)
            .then(({ error }) => { if (error) console.error('[Sync] slot auto-link failed:', error); })
        );
      }
      const newlyLinkedPanel = nextState.binderPanels.find(p => {
        const prev = prevState.binderPanels.find(pp => pp.id === p.id);
        return prev && !prev.inventoryItemId && p.inventoryItemId === item?.id;
      });
      if (newlyLinkedPanel) {
        pending.push(
          supabase.from('binder_panels').update({ inventory_item_id: newlyLinkedPanel.inventoryItemId }).eq('id', newlyLinkedPanel.id)
            .then(({ error }) => { if (error) console.error('[Sync] panel auto-link failed:', error); })
        );
      }
      break;
    }
    case ACTIONS.INVENTORY_UPDATE: {
      const item = nextState.inventory.find(i => i.id === action.payload.id);
      if (item) pending.push(upsertInventoryItem(item));
      break;
    }
    // === CHANGED (reverted per explicit request, matching the
    // reducer): back to an immediate, permanent delete instead of
    // soft-deleting to Trash — see reducer.js's INVENTORY_DELETE case
    // for the full reasoning. ===
    case ACTIONS.INVENTORY_DELETE: {
      const { inventoryId } = action.payload ?? {};
      if (inventoryId) {
        pending.push(
          supabase.from('user_inventory').delete().eq('id', inventoryId)
            .then(({ error }) => { if (error) console.error('[Sync] inventory delete failed:', error); })
        );

        // === Fixes two related, real bugs found via testing:
        // (1) originally this looked for a slot/panel that got
        // DELETED (id disappearing from the array) — but the reducer
        // was fixed to only UNLINK a slot when a copy is removed
        // (same id, inventoryItemId cleared to null), never delete it
        // outright, since an unowned card can still sit in a slot as
        // a grey placeholder. This stale diff logic never found
        // anything to sync, meaning the unlink happened locally but
        // never reached the database at all.
        // (2) the fix syncs an UPDATE (clearing inventory_item_id),
        // not a delete — matching what the reducer actually does now.
        const unlinkedSlot = nextState.binderSlots.find(s => {
          const prev = prevState.binderSlots.find(ps => ps.id === s.id);
          return prev && prev.inventoryItemId === inventoryId && s.inventoryItemId === null;
        });
        if (unlinkedSlot) {
          pending.push(
            supabase.from('binder_slots').update({ inventory_item_id: null }).eq('id', unlinkedSlot.id)
              .then(({ error }) => { if (error) console.error('[Sync] slot unlink failed:', error); })
          );
        }

        const unlinkedPanel = nextState.binderPanels.find(p => {
          const prev = prevState.binderPanels.find(pp => pp.id === p.id);
          return prev && prev.inventoryItemId === inventoryId && p.inventoryItemId === null;
        });
        if (unlinkedPanel) {
          pending.push(
            supabase.from('binder_panels').update({ inventory_item_id: null }).eq('id', unlinkedPanel.id)
              .then(({ error }) => { if (error) console.error('[Sync] panel unlink failed:', error); })
          );
        }
      }
      break;
    }

    // === New: bulk own/unown/favorite for multiselect. Sequential
    // writes (same reasoning as CARD_DEFINITION_BULK_ADD above), plus
    // the same auto-link/unlink diffing as the single-item cases —
    // just checked against every affected id at once instead of one.
    case ACTIONS.INVENTORY_BULK_ADD: {
      const newIds = new Set((action.payload?.items ?? []).map(i => i.id));
      const items = nextState.inventory.filter(i => newIds.has(i.id));

      const newlyLinkedSlots = nextState.binderSlots.filter(s => {
        const prev = prevState.binderSlots.find(ps => ps.id === s.id);
        return prev && !prev.inventoryItemId && s.inventoryItemId && newIds.has(s.inventoryItemId);
      });
      const newlyLinkedPanels = nextState.binderPanels.filter(p => {
        const prev = prevState.binderPanels.find(pp => pp.id === p.id);
        return prev && !prev.inventoryItemId && p.inventoryItemId && newIds.has(p.inventoryItemId);
      });

      pending.push((async () => {
        for (const item of items) await upsertInventoryItem(item);
        for (const slot of newlyLinkedSlots) {
          const { error } = await supabase.from('binder_slots').update({ inventory_item_id: slot.inventoryItemId }).eq('id', slot.id);
          if (error) console.error('[Sync] slot auto-link failed (bulk):', error);
        }
        for (const panel of newlyLinkedPanels) {
          const { error } = await supabase.from('binder_panels').update({ inventory_item_id: panel.inventoryItemId }).eq('id', panel.id);
          if (error) console.error('[Sync] panel auto-link failed (bulk):', error);
        }
      })());
      break;
    }
    case ACTIONS.INVENTORY_BULK_DELETE: {
      const deletedIds = action.payload?.inventoryIds ?? [];
      const deletedIdSet = new Set(deletedIds);

      const unlinkedSlots = nextState.binderSlots.filter(s => {
        const prev = prevState.binderSlots.find(ps => ps.id === s.id);
        return prev && deletedIdSet.has(prev.inventoryItemId) && s.inventoryItemId === null;
      });
      const unlinkedPanels = nextState.binderPanels.filter(p => {
        const prev = prevState.binderPanels.find(pp => pp.id === p.id);
        return prev && deletedIdSet.has(prev.inventoryItemId) && p.inventoryItemId === null;
      });

      pending.push((async () => {
        for (const id of deletedIds) {
          const { error } = await supabase.from('user_inventory').delete().eq('id', id);
          if (error) console.error('[Sync] inventory bulk delete failed:', error);
        }
        for (const slot of unlinkedSlots) {
          const { error } = await supabase.from('binder_slots').update({ inventory_item_id: null }).eq('id', slot.id);
          if (error) console.error('[Sync] slot unlink failed (bulk):', error);
        }
        for (const panel of unlinkedPanels) {
          const { error } = await supabase.from('binder_panels').update({ inventory_item_id: null }).eq('id', panel.id);
          if (error) console.error('[Sync] panel unlink failed (bulk):', error);
        }
      })());
      break;
    }
    case ACTIONS.INVENTORY_BULK_SET_FAVORITE: {
      const favIdSet = new Set(action.payload?.ids ?? []);
      const items = nextState.inventory.filter(i => favIdSet.has(i.id));
      pending.push((async () => {
        for (const item of items) await upsertInventoryItem(item);
      })());
      break;
    }
    default:
      break;
  }
}
