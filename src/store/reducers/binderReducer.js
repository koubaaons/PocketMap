/**
 * @fileoverview binderReducer — Binder metadata — create/update/delete a binder, add a page, swap two pages.
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
import { MAX_BINDER_PAGES } from '../../types/binder.types.js';

export function binderReducer(state, action) {
  switch (action.type) {


    case ACTIONS.BINDER_ADD:
      return { ...state, binders: [...state.binders, action.payload] };


    case ACTIONS.BINDER_UPDATE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };


    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload;
      const binder = state.binders.find(b => b.id === binderId);
      if (!binder) return state;
      return {
        ...state,
        binders: state.binders.filter(b => b.id !== binderId),
        binderSlots: state.binderSlots.filter(s => s.binderId !== binderId),
        binderPanels: state.binderPanels.filter(p => p.binderId !== binderId),
        bin: [...state.bin, { ...binder, _type: 'binder', deletedAt: Date.now() }],
        nav: state.nav.currentView === 'binder' && state.nav.currentBinderId === binderId
          ? { ...state.nav, currentView: 'home', currentBinderId: null, currentPage: 1 }
          : state.nav,
      };
    }


    case ACTIONS.BINDER_ADD_PAGE: {
      const binder = state.binders.find(b => b.id === action.payload.binderId);
      // === Real gap fixed: this case previously incremented pages
      // unconditionally, with no upper bound at all — completely
      // bypassing validateBinder's own pages limit, since adding a
      // page never goes through createBinder/validateBinder in the
      // first place. Silently no-ops once already at the cap, same
      // as every other "already at the limit" guard in this app.
      if (!binder || binder.pages >= MAX_BINDER_PAGES) return state;
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.binderId ? { ...b, pages: b.pages + 1 } : b
        ),
      };
    }

    // === New: Swap Pages — exchanges everything on page A with
    // everything on page B within one binder (cards a user has
    // requested, seen on other card-tracking sites). Just flips
    // pageNumber on whatever's currently sitting on either page —
    // slotIndex is left untouched, so each card keeps its same
    // row/column position, just on the other page. Covers both plain
    // slots and card-type combined panels (Michi Method); insert-type
    // panels (decorative art, not tied to a specific card) swap the
    // same way, since they're just as much "what's on this page" as
    // an actual card is.

    case ACTIONS.BINDER_SWAP_PAGES: {
      const { binderId, pageA, pageB } = action.payload;
      if (pageA === pageB || !Number.isInteger(pageA) || !Number.isInteger(pageB)) return state;

      const swapPage = (p) => (p === pageA ? pageB : p === pageB ? pageA : p);

      return {
        ...state,
        binderSlots: state.binderSlots.map(s =>
          s.binderId === binderId && (s.pageNumber === pageA || s.pageNumber === pageB)
            ? { ...s, pageNumber: swapPage(s.pageNumber) }
            : s
        ),
        binderPanels: state.binderPanels.map(p =>
          p.binderId === binderId && (p.pageNumber === pageA || p.pageNumber === pageB)
            ? { ...p, pageNumber: swapPage(p.pageNumber) }
            : p
        ),
      };
    }

    // ── Bin ───────────────────────────────────────────────────────────────────
    default:
      return state;
  }
}
