/**
 * @fileoverview Pure reducer — all state transitions live here.
 * No side effects. No localStorage, no DOM, no fetch.
 */

import { validateOneTemplatePerCollection } from '../types/index.js';

export const ACTIONS = Object.freeze({
  // Binders
  BINDER_ADD:    'BINDER_ADD',
  BINDER_UPDATE: 'BINDER_UPDATE',
  BINDER_DELETE: 'BINDER_DELETE',

  // Cards
  CARD_ADD:      'CARD_ADD',
  CARD_UPDATE:   'CARD_UPDATE',
  CARD_DELETE:   'CARD_DELETE',

  // Bin
  BIN_RESTORE:   'BIN_RESTORE',
  BIN_DELETE:    'BIN_DELETE',
  BIN_EMPTY:     'BIN_EMPTY',

  // Navigation
  NAV_SET: 'NAV_SET',

  // Collections
  COLLECTION_ADD:           'COLLECTION_ADD',
  COLLECTION_UPDATE:        'COLLECTION_UPDATE',
  COLLECTION_DELETE:        'COLLECTION_DELETE',

  // Template Fields
  TEMPLATE_FIELD_ADD:       'TEMPLATE_FIELD_ADD',
  TEMPLATE_FIELD_BULK_ADD:  'TEMPLATE_FIELD_BULK_ADD',
  TEMPLATE_FIELD_UPDATE:    'TEMPLATE_FIELD_UPDATE',

  TEMPLATE_FIELD_REORDER:   'TEMPLATE_FIELD_REORDER',


  // Card Definitions
  CARD_DEFINITION_ADD:      'CARD_DEFINITION_ADD',
  CARD_DEFINITION_BULK_ADD: 'CARD_DEFINITION_BULK_ADD',
  CARD_DEFINITION_UPDATE:   'CARD_DEFINITION_UPDATE',
  CARD_DEFINITION_DELETE:   'CARD_DEFINITION_DELETE',
});

export function reducer(state, action) {
  switch (action.type) {

    // ── Binders ──────────────────────────────────────────────────────────────

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
      return { ...state, cards: [...state.cards, action.payload] };

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
      const binderExists = state.binders.some(b => b.id === card.binderId);
      if (!binderExists) return state;
      const conflict = state.cards.some(
        c => c.binderId === card.binderId && c.page === card.page && c.slot === card.slot
      );
      if (conflict) return state;
      return {
        ...state,
        cards: [...state.cards, card],
        bin: state.bin.filter(c => c.id !== cardId),
      };
    }

    case ACTIONS.BIN_DELETE:
      return { ...state, bin: state.bin.filter(c => c.id !== action.payload.cardId) };

    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };

    // ── Navigation ────────────────────────────────────────────────────────────

    case ACTIONS.NAV_SET:
      return { ...state, nav: { ...state.nav, ...action.payload } };

    // ── Collections ───────────────────────────────────────────────────────────

    case ACTIONS.COLLECTION_ADD:
      return { ...state, collections: [...state.collections, action.payload] };

    case ACTIONS.COLLECTION_UPDATE:
      return {
        ...state,
        collections: state.collections.map(c =>
          c.id === action.payload.id
            ? { ...c, ...action.payload, updatedAt: Date.now() }
            : c
        ),
      };

    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload;
      const affectedCardDefIds = new Set(
        state.cardDefinitions
          .filter(cd => cd.collectionId === collectionId)
          .map(cd => cd.id)
      );
      return {
        ...state,
        collections: state.collections.filter(c => c.id !== collectionId),
        templateFields: state.templateFields.filter(f => f.collectionId !== collectionId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.collectionId !== collectionId),
        inventory: state.inventory.filter(inv => !affectedCardDefIds.has(inv.cardDefId)),
        nav: state.nav.currentView === 'collection' && state.nav.currentCollectionId === collectionId
          ? { ...state.nav, currentView: 'collections', currentCollectionId: null }
          : state.nav,
      };
    }

    // ── Template Fields ───────────────────────────────────────────────────────

    case ACTIONS.TEMPLATE_FIELD_ADD:
      return {
        ...state,
        templateFields: [...state.templateFields, action.payload],
      };

    // === ISSUE #11 START: Restrict To One Template Per Collection — enforce in reducer ===
    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      // payload is an array of template fields, all sharing the same collectionId
      const collectionId = action.payload[0]?.collectionId;
      if (!collectionId) {
        console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD: missing collectionId in payload');
        return state;
      }
      const { valid, error } = validateOneTemplatePerCollection(collectionId, state.templateFields);
      if (!valid) {
        // Reject silently — the UI should never allow this but we protect at the data layer
        console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD rejected:', error);
        return state;
      }
      return {
        ...state,
        templateFields: [...state.templateFields, ...action.payload],
      };
    }
    // === ISSUE #11 END: Restrict To One Template Per Collection ===

    case ACTIONS.TEMPLATE_FIELD_UPDATE:
      return {
        ...state,
        templateFields: state.templateFields.map(f =>
          f.id === action.payload.id ? { ...f, ...action.payload } : f
        ),
      };

    case ACTIONS.TEMPLATE_FIELD_REORDER: {
      // payload: { collectionId, fieldId, direction: 'up' | 'down' }
      const { collectionId, fieldId, direction } = action.payload;

      // Get only this collection's fields sorted by order
      const collectionFields = state.templateFields
        .filter(f => f.collectionId === collectionId)
        .sort((a, b) => a.order - b.order);

      const idx = collectionFields.findIndex(f => f.id === fieldId);
      if (idx === -1) return state;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= collectionFields.length) return state;

      // Swap order values between the two fields
      const fieldA = collectionFields[idx];
      const fieldB = collectionFields[swapIdx];

      return {
        ...state,
        templateFields: state.templateFields.map(f => {
          if (f.id === fieldA.id) return { ...f, order: fieldB.order };
          if (f.id === fieldB.id) return { ...f, order: fieldA.order };
          return f;
        }),
      };
    }


    // ── Card Definitions ──────────────────────────────────────────────────────

    case ACTIONS.CARD_DEFINITION_ADD:
      return { ...state, cardDefinitions: [...state.cardDefinitions, action.payload] };

    case ACTIONS.CARD_DEFINITION_BULK_ADD:
      return { ...state, cardDefinitions: [...state.cardDefinitions, ...action.payload] };

    case ACTIONS.CARD_DEFINITION_UPDATE:
      return {
        ...state,
        cardDefinitions: state.cardDefinitions.map(cd =>
          cd.id === action.payload.id
            ? { ...cd, ...action.payload, updatedAt: Date.now() }
            : cd
        ),
      };

    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload;
      return {
        ...state,
        inventory: state.inventory.filter(inv => inv.cardDefId !== cardDefId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== cardDefId),
      };
    }

    default:
      console.warn('[BinderVault] Unknown action type:', action.type);
      return state;
  }
}