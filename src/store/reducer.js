/**
 * @fileoverview Pure reducer — all state transitions live here.
 *
 * WHY A REDUCER:
 * - Every state change is an explicit, named action
 * - All business logic is in one place, not scattered across components
 * - State transitions are pure functions: easy to test, trace, and debug
 * - Trivially adds undo/redo: just keep an action log
 *
 * RULE: No side effects here. No localStorage, no DOM, no fetch.
 * This file can be unit-tested in Node with zero dependencies.
 */

// ─── Action Types ─────────────────────────────────────────────────────────────
// Enum-style constants prevent typo bugs in dispatch calls.

export const ACTIONS = Object.freeze({
  // Binders
  BINDER_ADD:    'BINDER_ADD',
  BINDER_UPDATE: 'BINDER_UPDATE',
  BINDER_DELETE: 'BINDER_DELETE',

  // Cards
  CARD_ADD:      'CARD_ADD',
  CARD_UPDATE:   'CARD_UPDATE',
  CARD_DELETE:   'CARD_DELETE',   // → moves to bin

  // Bin
  BIN_RESTORE:   'BIN_RESTORE',
  BIN_DELETE:    'BIN_DELETE',    // permanent
  BIN_EMPTY:     'BIN_EMPTY',

  // Navigation
  NAV_SET:       'NAV_SET',
});

// ─── Pure Reducer ─────────────────────────────────────────────────────────────

/**
 * @param {object} state
 * @param {{ type: string, payload?: any }} action
 * @returns {object} Next state (never mutates the input)
 */
export function reducer(state, action) {
  switch (action.type) {

    // ── Binders ──────────────────────────────────────────────────────────────

    case ACTIONS.BINDER_ADD:
      return {
        ...state,
        binders: [...state.binders, action.payload],
      };

    case ACTIONS.BINDER_UPDATE: {
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };
    }

    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload;
      const orphanedCards = state.cards.filter(c => c.binderId === binderId);
      const binItems = orphanedCards.map(c => ({ ...c, deletedAt: Date.now() }));
      return {
        ...state,
        binders: state.binders.filter(b => b.id !== binderId),
        cards: state.cards.filter(c => c.binderId !== binderId),
        bin: [...state.bin, ...binItems],
        nav: state.nav.currentView === 'binder' && state.nav.currentBinderId === binderId
          ? { ...state.nav, currentView: 'home', currentBinderId: null, currentPage: 1 }
          : state.nav,
      };
    }

    // ── Cards ─────────────────────────────────────────────────────────────────

    case ACTIONS.CARD_ADD:
      return {
        ...state,
        cards: [...state.cards, action.payload],
      };

    case ACTIONS.CARD_UPDATE:
      return {
        ...state,
        cards: state.cards.map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case ACTIONS.CARD_DELETE: {
      const card = state.cards.find(c => c.id === action.payload.cardId);
      if (!card) return state;
      return {
        ...state,
        cards: state.cards.filter(c => c.id !== action.payload.cardId),
        bin: [...state.bin, { ...card, deletedAt: Date.now() }],
      };
    }

    // ── Bin ───────────────────────────────────────────────────────────────────

    case ACTIONS.BIN_RESTORE: {
      const { cardId } = action.payload;
      const item = state.bin.find(c => c.id === cardId);
      if (!item) return state;
      const { deletedAt, ...card } = item;
      // Check the binder still exists
      const binderExists = state.binders.some(b => b.id === card.binderId);
      if (!binderExists) return state; // caller should handle this error case
      // Check for slot conflict
      const conflict = state.cards.some(
        c => c.binderId === card.binderId && c.page === card.page && c.slot === card.slot
      );
      if (conflict) return state; // caller should handle this error case
      return {
        ...state,
        cards: [...state.cards, card],
        bin: state.bin.filter(c => c.id !== cardId),
      };
    }

    case ACTIONS.BIN_DELETE:
      return {
        ...state,
        bin: state.bin.filter(c => c.id !== action.payload.cardId),
      };

    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };

    // ── Navigation ────────────────────────────────────────────────────────────

    case ACTIONS.NAV_SET:
      return {
        ...state,
        nav: { ...state.nav, ...action.payload },
      };

    default:
      console.warn('[BinderVault] Unknown action type:', action.type);
      return state;
  }
}