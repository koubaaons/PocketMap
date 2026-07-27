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
      if (!item) break;

      // === Fixes a real, intermittent bug: the upsert and the
      // auto-link update below used to be pushed as two independent,
      // unordered promises. binder_slots.inventory_item_id (and the
      // equivalent on binder_panels) has a real foreign key
      // constraint against user_inventory(id) — if the auto-link
      // update reached the database before the insert above had
      // actually committed, it failed outright with a foreign-key
      // violation (surfaced as a 409). A race, not a guaranteed
      // failure, which is why it only showed up intermittently.
      // Fixed by explicitly awaiting the insert first, inside one
      // combined async function, instead of relying on both being
      // pushed to the same array ever implying an order between them.
      pending.push((async () => {
        await upsertInventoryItem(item);

        // === Fixes the real "disconnected from binders" bug — the
        // reducer may have auto-linked an existing, unowned placeholder
        // slot/panel to this newly-added copy (see reducer.js's
        // INVENTORY_ADD case). Diffing prevState/nextState is how the
        // sync layer finds out whether that happened and, if so, which
        // one, since the action payload itself only ever mentions the
        // new inventory item.
        const newlyLinkedSlot = nextState.binderSlots.find(s => {
          const prev = prevState.binderSlots.find(ps => ps.id === s.id);
          return prev && !prev.inventoryItemId && s.inventoryItemId === item.id;
        });
        if (newlyLinkedSlot) {
          const { error } = await supabase.from('binder_slots').update({ inventory_item_id: newlyLinkedSlot.inventoryItemId }).eq('id', newlyLinkedSlot.id);
          if (error) console.error('[Sync] slot auto-link failed:', error);
        }

        const newlyLinkedPanel = nextState.binderPanels.find(p => {
          const prev = prevState.binderPanels.find(pp => pp.id === p.id);
          return prev && !prev.inventoryItemId && p.inventoryItemId === item.id;
        });
        if (newlyLinkedPanel) {
          const { error } = await supabase.from('binder_panels').update({ inventory_item_id: newlyLinkedPanel.inventoryItemId }).eq('id', newlyLinkedPanel.id);
          if (error) console.error('[Sync] panel auto-link failed:', error);
        }
      })());
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

        // === CHANGED: matches the actual current reducer behavior
        // (#165) — unowning a placed copy REMOVES that slot/panel
        // entirely now, it doesn't merely clear its inventoryItemId
        // to null while leaving the row in place. The diff below used
        // to look for a slot that still exists in nextState with its
        // link nulled out — which stopped ever matching anything the
        // moment #165 shipped, meaning the actual Supabase row was
        // never deleted at all: it just sat there forever, and
        // because inventory_item_id has a real foreign key with ON
        // DELETE SET NULL, it silently reappeared on the very next
        // reload looking exactly like a legitimate missing
        // placeholder the user had deliberately created. Fixed by
        // diffing for a slot/panel that disappeared ENTIRELY (present
        // in prevState, absent from nextState) and deleting that row
        // outright, matching what actually happens locally now.
        const removedSlot = prevState.binderSlots.find(ps => {
          const stillExists = nextState.binderSlots.some(s => s.id === ps.id);
          return !stillExists && ps.inventoryItemId === inventoryId;
        });
        if (removedSlot) {
          pending.push(
            supabase.from('binder_slots').delete().eq('id', removedSlot.id)
              .then(({ error }) => { if (error) console.error('[Sync] slot delete failed:', error); })
          );
        }

        const removedPanel = prevState.binderPanels.find(pp => {
          const stillExists = nextState.binderPanels.some(p => p.id === pp.id);
          return !stillExists && pp.inventoryItemId === inventoryId;
        });
        if (removedPanel) {
          pending.push(
            supabase.from('binder_panels').delete().eq('id', removedPanel.id)
              .then(({ error }) => { if (error) console.error('[Sync] panel delete failed:', error); })
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

      // === CHANGED: same fix as the single-item INVENTORY_DELETE
      // case above — diffs for slots/panels that disappeared entirely
      // (present in prevState, absent from nextState) rather than
      // ones that merely got their link nulled out, matching what the
      // reducer has actually done since #165.
      const removedSlots = prevState.binderSlots.filter(ps => {
        const stillExists = nextState.binderSlots.some(s => s.id === ps.id);
        return !stillExists && deletedIdSet.has(ps.inventoryItemId);
      });
      const removedPanels = prevState.binderPanels.filter(pp => {
        const stillExists = nextState.binderPanels.some(p => p.id === pp.id);
        return !stillExists && deletedIdSet.has(pp.inventoryItemId);
      });

      pending.push((async () => {
        for (const id of deletedIds) {
          const { error } = await supabase.from('user_inventory').delete().eq('id', id);
          if (error) console.error('[Sync] inventory bulk delete failed:', error);
        }
        for (const slot of removedSlots) {
          const { error } = await supabase.from('binder_slots').delete().eq('id', slot.id);
          if (error) console.error('[Sync] slot delete failed (bulk):', error);
        }
        for (const panel of removedPanels) {
          const { error } = await supabase.from('binder_panels').delete().eq('id', panel.id);
          if (error) console.error('[Sync] panel delete failed (bulk):', error);
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