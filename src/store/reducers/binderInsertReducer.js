/**
 * @fileoverview binderInsertReducer — The Michi Method image library — adding (single/batch) and soft-deleting (single/batch) library images.
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

export function binderInsertReducer(state, action) {
  switch (action.type) {


    case ACTIONS.BINDER_INSERT_ADD:
      return { ...state, binderInserts: [...state.binderInserts, action.payload] };

    // === New: batch upload into the image library — requested
    // directly ("add in a batch like multiselect, not one at a
    // time"). Same shape as CARD_DEFINITION_BULK_ADD.

    case ACTIONS.BINDER_INSERT_BULK_ADD:
      return { ...state, binderInserts: [...state.binderInserts, ...action.payload] };

    // === CHANGED: soft delete, matching every other deletable entity
    // in this app (binders, collections, cards) instead of being the
    // one thing that destroys itself immediately. Moves to state.bin,
    // restorable via BIN_RESTORE_INSERT, permanently removed only via
    // BIN_DELETE_ITEM/BIN_EMPTY from Trash.
    //
    // Panels using this image get insertId CLEARED (blank, still
    // combined) rather than being removed outright — an insert-type
    // panel with no image is exactly as legitimate a state as a
    // regular slot with no owner (see BinderSlot's own placeholder
    // handling), so there's no reason to destroy the combined space
    // itself just because its picture went to Trash.

    case ACTIONS.BINDER_INSERT_DELETE: {
      const { insertId } = action.payload;
      const insert = state.binderInserts.find(i => i.id === insertId);
      if (!insert) return state;
      return {
        ...state,
        binderInserts: state.binderInserts.filter(i => i.id !== insertId),
        binderPanels: state.binderPanels.map(p =>
          p.insertId === insertId ? { ...p, insertId: null } : p
        ),
        bin: [...state.bin, { ...insert, _type: 'insert', deletedAt: Date.now() }],
      };
    }

    // === New: bulk soft-delete for the library's multiselect. Folds
    // the single-item case over each id — same reasoning as
    // INVENTORY_BULK_ADD/DELETE above (reuse tested single-item
    // logic rather than re-deriving it).

    case ACTIONS.BINDER_INSERT_BULK_DELETE: {
      return (action.payload?.insertIds ?? []).reduce(
        (accState, insertId) => applyBinderInsertDelete(accState, insertId),
        state
      );
    }
    default:
      return state;
  }
}


// Local helper the bulk-delete action above folds over — same logic
// as the single-item case, just callable directly instead of
// recursing through the root reducer.
function applyBinderInsertDelete(state, insertId) {
  return binderInsertReducer(state, { type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId } });
}
