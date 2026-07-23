/**
 * @fileoverview binderPanelReducer — Combined slot panels (Michi Method) — creating, repositioning/resizing, and removing a combined panel.
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

export function binderPanelReducer(state, action) {
  switch (action.type) {


    case ACTIONS.BINDER_PANEL_ADD: {
      const panel = action.payload;
      const binder = state.binders.find(b => b.id === panel.binderId);
      if (!binder) { console.warn('[Pinder] BINDER_PANEL_ADD: binder not found', panel.binderId); return state; }

      const newIndices = getSlotIndicesForPanel(panel.startSlotIndex, panel.spanCols, panel.spanRows, binder.cols);

      // Reject if any covered position already has an individual card
      // placed there — combining should never silently discard an
      // existing card; the person needs to remove it first.
      const conflictingSlot = state.binderSlots.find(
        s => s.binderId === panel.binderId && s.pageNumber === panel.pageNumber && newIndices.includes(s.slotIndex)
      );
      if (conflictingSlot) {
        console.warn('[Pinder] BINDER_PANEL_ADD: a slot in this range already has a card placed — remove it first', conflictingSlot);
        return state;
      }

      // Reject if any covered position already belongs to another
      // panel — panels can't overlap.
      const overlappingPanel = state.binderPanels.find(p => {
        if (p.binderId !== panel.binderId || p.pageNumber !== panel.pageNumber) return false;
        const existingIndices = getSlotIndicesForPanel(p.startSlotIndex, p.spanCols, p.spanRows, binder.cols);
        return existingIndices.some(i => newIndices.includes(i));
      });
      if (overlappingPanel) {
        console.warn('[Pinder] BINDER_PANEL_ADD: overlaps an existing panel', overlappingPanel.id);
        return state;
      }

      // === FIX (same regression as BINDER_SLOT_ADD, caught by a test
      // before ever being reported): a card-type panel for a card
      // that isn't owned at all used to be rejected outright — the
      // quantity-tracking logic below required finding an unplaced
      // OWNED copy before allowing ANY placement. An unowned card
      // should still be placeable as a grey placeholder here too,
      // same as a normal slot. ===
      let finalPanel = panel;
      if (panel.panelType === 'card') {
        const quantityOwned = state.inventory.filter(inv => inv.cardDefId === panel.cardDefId).length;
        if (quantityOwned === 0) {
          finalPanel = { ...panel, inventoryItemId: null };
        } else {
          const placedInventoryIds = new Set([
            ...state.binderSlots.filter(s => s.inventoryItemId).map(s => s.inventoryItemId),
            ...state.binderPanels.filter(p => p.panelType === 'card' && p.inventoryItemId).map(p => p.inventoryItemId),
          ]);
          const unplacedCopy = state.inventory.find(
            inv => inv.cardDefId === panel.cardDefId && !placedInventoryIds.has(inv.id)
          );
          if (!unplacedCopy) {
            console.warn('[Pinder] BINDER_PANEL_ADD: no unplaced copies left for this card', panel.cardDefId);
            return state;
          }
          finalPanel = { ...panel, inventoryItemId: unplacedCopy.id };
        }
      }

      return { ...state, binderPanels: [...state.binderPanels, finalPanel] };
    }


    case ACTIONS.BINDER_PANEL_UPDATE:
      return {
        ...state,
        binderPanels: state.binderPanels.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };


    case ACTIONS.BINDER_PANEL_REMOVE:
      // Removing a panel just returns its slot positions to normal,
      // empty, individually-placeable slots — nothing else to clean
      // up, since binder_slots was never touched by combining in the
      // first place.
      return {
        ...state,
        binderPanels: state.binderPanels.filter(p => p.id !== action.payload.panelId),
      };
    default:
      return state;
  }
}

// === Michi Method support: computes every absolute slot index a
// panel covers, given the binder's own column count — needed because
// a panel spanning multiple ROWS doesn't cover a contiguous range of
// indices (e.g. a 2-wide, 2-tall panel starting at index 1 in a
// 3-column grid covers 1, 2, 4, 5 — not 1, 2, 3, 4). ===
function getSlotIndicesForPanel(startSlotIndex, spanCols, spanRows, gridCols) {
  const indices = [];
  const startRow = Math.floor(startSlotIndex / gridCols);
  const startCol = startSlotIndex % gridCols;
  for (let r = 0; r < spanRows; r++) {
    for (let c = 0; c < spanCols; c++) {
      indices.push((startRow + r) * gridCols + (startCol + c));
    }
  }
  return indices;
}