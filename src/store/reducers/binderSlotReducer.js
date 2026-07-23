/**
 * @fileoverview binderSlotReducer — Individual binder slots — placing a card (owned or missing), moving it, removing it.
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

export function binderSlotReducer(state, action) {
  switch (action.type) {


    case ACTIONS.BINDER_SLOT_ADD: {
      const { slot } = action.payload;
      // === FIX (real bug: slots that render blank but still say
      // "already occupied"): the old check only asked "does ANY slot
      // record exist at this position" — it never verified that
      // record's card still actually exists. If a card gets deleted
      // while a binder_slots row still references it (a genuine
      // possibility given sync-timing edge cases elsewhere in this
      // app), that row becomes an orphan: it renders blank (no card
      // data to show) but still counted as "occupied" here, blocking
      // any new card from ever being placed there again — the only
      // previous workaround was deleting the whole binder. Now,
      // finding an existing slot whose card no longer exists doesn't
      // block the new placement — it gets replaced instead.
      const existingAtPosition = state.binderSlots.find(
        s => s.binderId === slot.binderId && s.pageNumber === slot.pageNumber && s.slotIndex === slot.slotIndex
      );
      if (existingAtPosition) {
        const cardStillExists = state.cardDefinitions.some(cd => cd.id === existingAtPosition.cardDefId);
        if (cardStillExists) {
          console.warn('[Pinder] BINDER_SLOT_ADD: slot already occupied', slot);
          return state;
        }
        console.warn('[Pinder] BINDER_SLOT_ADD: replacing orphaned slot (card no longer exists)', existingAtPosition.id);
      }

      // === CHANGED: a card — owned or not, regardless of how many
      // physical copies exist — can now only ever be placed in ONE
      // binder at a time, period. Requested directly. Previously,
      // owning multiple copies let the same card sit in several
      // different binders simultaneously (up to quantityOwned
      // placements, counted globally); now the very first placement
      // anywhere blocks any other. Extra copies beyond that one
      // placement just stay in inventory/Unorganised — they don't
      // need a slot of their own. This replaces the old
      // quantity-vs-placed-count comparison entirely; see
      // binderSelectors.js's getFullyPlacedCardDefIds for the
      // matching UI-side simplification.
      const alreadyPlacedAnywhere =
        state.binderSlots.some(s => s.id !== existingAtPosition?.id && s.cardDefId === slot.cardDefId) ||
        state.binderPanels.some(p => p.panelType === 'card' && p.cardDefId === slot.cardDefId);
      if (alreadyPlacedAnywhere) {
        console.warn('[Pinder] BINDER_SLOT_ADD: this card is already placed in a binder', slot.cardDefId);
        return state;
      }

      // Not placed anywhere yet. If owned, link the new slot to
      // whichever copy the caller explicitly requested (e.g. "place
      // the English one, not the Chinese one" from a copy picker) —
      // validated here rather than trusted blindly, in case of stale
      // UI state. Otherwise just use the first owned copy: since a
      // card is only ever placed once in total now, there's no
      // meaningful "which unplaced copy" choice to make beyond that.
      let inventoryItemId;
      if (slot.inventoryItemId) {
        const requested = state.inventory.find(inv => inv.id === slot.inventoryItemId && inv.cardDefId === slot.cardDefId);
        if (!requested) {
          console.warn('[Pinder] BINDER_SLOT_ADD: requested inventoryItemId is not a valid, owned copy of this card', slot.inventoryItemId);
          return state;
        }
        inventoryItemId = requested.id;
      } else {
        const anyOwnedCopy = state.inventory.find(inv => inv.cardDefId === slot.cardDefId);
        inventoryItemId = anyOwnedCopy?.id ?? null;
      }

      return {
        ...state,
        binderSlots: [
          ...state.binderSlots.filter(s => s.id !== existingAtPosition?.id),
          { ...slot, inventoryItemId },
        ],
      };
    }


    // === New action: links a slot to a specific inventory item —
    // needed so marking an unowned placeholder slot as owned (the
    // hover ✓/○ toggle) links the newly-created copy to THIS exact
    // slot, not just "the card overall". Without this, the slot's
    // inventoryItemId would stay null even though the card now shows
    // as owned somewhere — meaning a later attempt to unown from this
    // same slot wouldn't know which specific copy to remove, and
    // could accidentally affect a different copy instead (see
    // handleToggleOwnedInSlot in BinderView.jsx for the full fix this
    // supports).

    case ACTIONS.BINDER_SLOT_UPDATE: {
      const { slotId, inventoryItemId } = action.payload;
      return {
        ...state,
        binderSlots: state.binderSlots.map(s => s.id === slotId ? { ...s, inventoryItemId } : s),
      };
    }


    case ACTIONS.BINDER_SLOT_REMOVE:
      return { ...state, binderSlots: state.binderSlots.filter(s => s.id !== action.payload.slotId) };

    // === FIX: swap-aware move. The old version silently rejected any
    // move to an occupied destination ("target slot occupied"), which
    // meant Save Layout — dispatching one BINDER_SLOT_MOVE per changed
    // slot, one at a time — would fail for any slot whose destination was
    // still occupied by the OLD (pre-preview) position of another card
    // that hadn't been moved yet in this same dispatch sequence. The
    // failed move silently returned unchanged state, so that card
    // appeared to "snap back" to its original position after saving —
    // it never actually got its new position applied to the real store.
    //
    // Now: if the destination is occupied, swap both slots' positions in
    // one atomic state update instead of rejecting. This matches how
    // preview-mode swapping already works (see useBinderView.js
    // previewMoveSlot), so save-time behavior is consistent with what the
    // user saw and did during preview — no dispatch-order dependency.

    case ACTIONS.BINDER_SLOT_MOVE: {
      const { slotId, pageNumber, slotIndex } = action.payload;
      const movingSlot = state.binderSlots.find(s => s.id === slotId);
      if (!movingSlot) return state;

      const targetSlot = state.binderSlots.find(
        s => s.binderId === movingSlot.binderId &&
             s.pageNumber === pageNumber &&
             s.slotIndex === slotIndex &&
             s.id !== slotId
      );

      if (targetSlot) {
        return {
          ...state,
          binderSlots: state.binderSlots.map(s => {
            if (s.id === slotId) return { ...s, pageNumber, slotIndex };
            if (s.id === targetSlot.id) return { ...s, pageNumber: movingSlot.pageNumber, slotIndex: movingSlot.slotIndex };
            return s;
          }),
        };
      }

      return {
        ...state,
        binderSlots: state.binderSlots.map(s =>
          s.id === slotId ? { ...s, pageNumber, slotIndex } : s
        ),
      };
    }

    // === Michi Method support: combined slots ===
    default:
      return state;
  }
}
