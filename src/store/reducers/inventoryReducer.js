/**
 * @fileoverview inventoryReducer — Owned copies (inventory items) — mark owned/unowned, update acquisition details, and the batch (multiselect) versions of each.
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

export function inventoryReducer(state, action) {
  switch (action.type) {

    case ACTIONS.INVENTORY_ADD: {
      const newItem = action.payload;
      const newInventory = [...state.inventory, newItem];

      const unlinkedSlot = state.binderSlots.find(s => s.cardDefId === newItem.cardDefId && !s.inventoryItemId);
      const unlinkedPanel = !unlinkedSlot
        ? state.binderPanels.find(p => p.panelType === 'card' && p.cardDefId === newItem.cardDefId && !p.inventoryItemId)
        : null;

      let binderSlots = state.binderSlots;
      let binderPanels = state.binderPanels;
      if (unlinkedSlot) {
        binderSlots = state.binderSlots.map(s => s.id === unlinkedSlot.id ? { ...s, inventoryItemId: newItem.id } : s);
      } else if (unlinkedPanel) {
        binderPanels = state.binderPanels.map(p => p.id === unlinkedPanel.id ? { ...p, inventoryItemId: newItem.id } : p);
      }

      return { ...state, inventory: newInventory, binderSlots, binderPanels };
    }


    case ACTIONS.INVENTORY_UPDATE:
      return {
        ...state,
        inventory: state.inventory.map(inv =>
          inv.id === action.payload.id
            ? { ...inv, ...action.payload, updatedAt: Date.now() }
            : inv
        ),
      };

    // === CHANGED (quantity tracking): this used to hard-remove the
    // row immediately and permanently — the only entity in the whole
    // app that worked that way, everything else (binders,
    // collections, cards) soft-deletes to the Trash Bin first. Now
    // matches that same pattern: moves to state.bin instead, fully
    // restorable, with a real permanent-delete step later via
    // BIN_DELETE_ITEM (whose existing generic fallback already
    // handles this type correctly with no extra work needed there).
    //
    // Also fixes a real, separate bug: binder_slots only tracks
    // WHICH CARD is placed (cardDefId), not which specific physical
    // copy — so removing a copy that happened to be placed somewhere
    // left its slot behind untouched, with no copy left to justify
    // it. Since there's no way to know exactly which slot
    // corresponds to the copy just removed (all placements of the
    // same card are functionally identical), the fix is: if the
    // remaining owned count is now less than the placed count,
    // remove exactly one placement for this card — preferring a
    // normal slot over a card-type panel — to bring the two back
    // into balance.
    // === CHANGED (reverted per explicit request): this briefly
    // soft-deleted to the Trash Bin, matching how binders/collections/
    // cards work. Reverted back to an immediate, permanent removal —
    // unowning is trivially reversible already (click the ownership
    // circle again to re-own), so routing it through Trash/restore
    // added a confirmation step and a whole extra UI section for
    // something that never actually needed recovering. The other fix
    // below stays: the specific slot/panel linked to this exact copy
    // gets UNLINKED, not deleted — it remains as a grey, unowned
    // placeholder, since a slot holding an unowned card has always
    // been a legitimate state in this app. ===

    case ACTIONS.INVENTORY_DELETE: {
      const item = state.inventory.find(inv => inv.id === action.payload.inventoryId);
      if (!item) return state;

      const remainingInventory = state.inventory.filter(inv => inv.id !== item.id);

      // === CHANGED: unowning a copy that's placed in a binder now
      // REMOVES that slot/panel entirely, instead of converting it
      // into a grey "missing" placeholder. Requested directly:
      // pulling a card out of a binder should leave an empty hole,
      // the same way it would physically — not silently leave behind
      // a wishlist-style marker nobody asked for. This also avoids a
      // real inconsistency with the #157 placement rule: converting
      // to inventoryItemId: null here could have created a SECOND
      // missing placeholder for a card that already has one
      // elsewhere, violating the "only one, ever" rule that governs
      // missing placeholders everywhere else.
      //
      // Finds the EXACT slot/panel linked to this specific copy via
      // inventoryItemId, rather than an arbitrary one. Falls back to
      // the old count-based approach only for pre-migration slots
      // that were never linked to any specific copy at all — in that
      // case there's genuinely no way to know which one corresponds
      // to this copy.
      let removedSlotId = null, removedPanelId = null;
      const linkedSlot = state.binderSlots.find(s => s.inventoryItemId === item.id);
      if (linkedSlot) {
        removedSlotId = linkedSlot.id;
      } else {
        const linkedPanel = state.binderPanels.find(p => p.panelType === 'card' && p.inventoryItemId === item.id);
        if (linkedPanel) {
          removedPanelId = linkedPanel.id;
        } else {
          const quantityOwned = remainingInventory.filter(inv => inv.cardDefId === item.cardDefId).length;
          const totalPlaced =
            state.binderSlots.filter(s => s.cardDefId === item.cardDefId).length +
            state.binderPanels.filter(p => p.panelType === 'card' && p.cardDefId === item.cardDefId).length;
          if (totalPlaced > quantityOwned) {
            const excessSlot = state.binderSlots.find(s => s.cardDefId === item.cardDefId);
            if (excessSlot) {
              removedSlotId = excessSlot.id;
            } else {
              const excessPanel = state.binderPanels.find(p => p.panelType === 'card' && p.cardDefId === item.cardDefId);
              if (excessPanel) removedPanelId = excessPanel.id;
            }
          }
        }
      }

      const binderSlots = removedSlotId
        ? state.binderSlots.filter(s => s.id !== removedSlotId)
        : state.binderSlots;
      const binderPanels = removedPanelId
        ? state.binderPanels.filter(p => p.id !== removedPanelId)
        : state.binderPanels;

      return {
        ...state,
        inventory: remainingInventory,
        binderSlots,
        binderPanels,
      };
    }

    // === New: bulk own/unown/favorite — for multiselect actions
    // across a grid of cards. Bulk add/delete deliberately reuse the
    // exact single-item logic above (auto-linking a new copy to an
    // unlinked slot/panel; carefully unlinking only the slot/panel
    // tied to the specific copy being removed) by folding this same
    // reducer over each item in turn, rather than re-deriving that
    // logic a second time in a way that could quietly drift out of
    // sync with the single-item version.

    case ACTIONS.INVENTORY_BULK_ADD: {
      return action.payload.items.reduce(
        (accState, item) => applyInventoryAdd(accState, item),
        state
      );
    }


    case ACTIONS.INVENTORY_BULK_DELETE: {
      return action.payload.inventoryIds.reduce(
        (accState, inventoryId) => applyInventoryDelete(accState, inventoryId),
        state
      );
    }


    case ACTIONS.INVENTORY_BULK_SET_FAVORITE: {
      const { ids, isFavorite } = action.payload;
      const idSet = new Set(ids);
      return {
        ...state,
        inventory: state.inventory.map(inv =>
          idSet.has(inv.id) ? { ...inv, is_favorite: isFavorite, updatedAt: Date.now() } : inv
        ),
      };
    }
    default:
      return state;
  }
}


// Local helpers the bulk actions above fold over — same logic as the
// single-item cases, just callable directly instead of recursing
// through the root reducer (which would need a circular import back
// here).
function applyInventoryAdd(state, item) {
  return inventoryReducer(state, { type: ACTIONS.INVENTORY_ADD, payload: item });
}

function applyInventoryDelete(state, inventoryId) {
  return inventoryReducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId } });
}