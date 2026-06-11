/**
 * @fileoverview Pure reducer — all state transitions live here.
 * No side effects. No localStorage, no DOM, no fetch.
 */

import { validateOneTemplatePerCollection } from '../types/index.js';

export const ACTIONS = Object.freeze({
  // Binders
  BINDER_ADD:      'BINDER_ADD',
  BINDER_UPDATE:   'BINDER_UPDATE',
  BINDER_DELETE:   'BINDER_DELETE',
  // === ISSUE #53 START: Binder Slot Entity ===
  BINDER_ADD_PAGE: 'BINDER_ADD_PAGE',
  // === ISSUE #53 END ===

  // === ISSUE #58 START: Legacy card actions kept for migration ===
  CARD_ADD:    'CARD_ADD',
  CARD_UPDATE: 'CARD_UPDATE',
  CARD_DELETE: 'CARD_DELETE',
  // === ISSUE #58 END ===

  // Bin — three sections
  // === ISSUE #57 START: Redesigned Trash Bin ===
  BIN_RESTORE_BINDER:     'BIN_RESTORE_BINDER',
  BIN_RESTORE_COLLECTION: 'BIN_RESTORE_COLLECTION',
  BIN_RESTORE_CARD:       'BIN_RESTORE_CARD',
  BIN_DELETE_ITEM:        'BIN_DELETE_ITEM',
  BIN_EMPTY:              'BIN_EMPTY',
  // === ISSUE #57 END ===

  // Navigation
  NAV_SET: 'NAV_SET',

  // Collections
  COLLECTION_ADD:    'COLLECTION_ADD',
  COLLECTION_UPDATE: 'COLLECTION_UPDATE',
  COLLECTION_DELETE: 'COLLECTION_DELETE',

  // Template Fields
  TEMPLATE_FIELD_ADD:      'TEMPLATE_FIELD_ADD',
  TEMPLATE_FIELD_BULK_ADD: 'TEMPLATE_FIELD_BULK_ADD',
  TEMPLATE_FIELD_UPDATE:   'TEMPLATE_FIELD_UPDATE',
  TEMPLATE_FIELD_REORDER:  'TEMPLATE_FIELD_REORDER',

  // Card Definitions
  CARD_DEFINITION_ADD:      'CARD_DEFINITION_ADD',
  CARD_DEFINITION_BULK_ADD: 'CARD_DEFINITION_BULK_ADD',
  CARD_DEFINITION_UPDATE:   'CARD_DEFINITION_UPDATE',
  CARD_DEFINITION_DELETE:   'CARD_DEFINITION_DELETE',

  // Inventory
  INVENTORY_ADD:    'INVENTORY_ADD',
  INVENTORY_UPDATE: 'INVENTORY_UPDATE',
  INVENTORY_DELETE: 'INVENTORY_DELETE',

  // === ISSUE #53 START: Binder Slot Entity — slot actions ===
  BINDER_SLOT_ADD:    'BINDER_SLOT_ADD',
  BINDER_SLOT_REMOVE: 'BINDER_SLOT_REMOVE',
  BINDER_SLOT_MOVE:   'BINDER_SLOT_MOVE',
  // === ISSUE #53 END ===
});

export function reducer(state, action) {
  switch (action.type) {

    // ── Binders ───────────────────────────────────────────────────────────────

    case ACTIONS.BINDER_ADD:
      return { ...state, binders: [...state.binders, action.payload] };

    case ACTIONS.BINDER_UPDATE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };

    // === ISSUE #57 START: BINDER_DELETE — send to bin ===
    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload;
      const binder = state.binders.find(b => b.id === binderId);
      if (!binder) return state;
      return {
        ...state,
        binders: state.binders.filter(b => b.id !== binderId),
        // Remove all slots for this binder
        binderSlots: state.binderSlots.filter(s => s.binderId !== binderId),
        // Send binder to bin
        bin: [...state.bin, { ...binder, _type: 'binder', deletedAt: Date.now() }],
        nav: state.nav.currentView === 'binder' && state.nav.currentBinderId === binderId
          ? { ...state.nav, currentView: 'home', currentBinderId: null, currentPage: 1 }
          : state.nav,
      };
    }
    // === ISSUE #57 END ===

    // === ISSUE #53 START: BINDER_ADD_PAGE ===
    case ACTIONS.BINDER_ADD_PAGE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.binderId
            ? { ...b, pages: b.pages + 1 }
            : b
        ),
      };
    // === ISSUE #53 END ===

    // ── Cards (legacy — kept for migration) ───────────────────────────────────

    case ACTIONS.CARD_ADD:
      return { ...state, cards: [...(state.cards ?? []), action.payload] };

    case ACTIONS.CARD_UPDATE:
      return {
        ...state,
        cards: (state.cards ?? []).map(c =>
          c.id === action.payload.id ? { ...c, ...action.payload } : c
        ),
      };

    case ACTIONS.CARD_DELETE: {
      const card = (state.cards ?? []).find(c => c.id === action.payload.cardId);
      if (!card) return state;
      return {
        ...state,
        cards: (state.cards ?? []).filter(c => c.id !== action.payload.cardId),
        bin: [...state.bin, { ...card, _type: 'legacy_card', deletedAt: Date.now() }],
      };
    }

    // ── Bin ───────────────────────────────────────────────────────────────────

    // === ISSUE #57 START: Redesigned Trash Bin — three section restore/delete ===
    case ACTIONS.BIN_RESTORE_BINDER: {
      const { itemId } = action.payload;
      const item = state.bin.find(b => b.id === itemId && b._type === 'binder');
      if (!item) return state;
      const { _type, deletedAt, ...binder } = item;
      return {
        ...state,
        binders: [...state.binders, binder],
        bin: state.bin.filter(b => b.id !== itemId),
      };
    }

    case ACTIONS.BIN_RESTORE_COLLECTION: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'collection');
      if (!item) return state;
      const { _type, deletedAt, ...collection } = item;
      return {
        ...state,
        collections: [...state.collections, collection],
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    case ACTIONS.BIN_RESTORE_CARD: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'cardDef');
      if (!item) return state;
      const { _type, deletedAt, ...cardDef } = item;
      return {
        ...state,
        cardDefinitions: [...state.cardDefinitions, cardDef],
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    case ACTIONS.BIN_DELETE_ITEM:
      return { ...state, bin: state.bin.filter(b => b.id !== action.payload.itemId) };

    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };
    // === ISSUE #57 END ===

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

    // === ISSUE #57 START: COLLECTION_DELETE — send to bin ===
    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload;
      const collection = state.collections.find(c => c.id === collectionId);
      if (!collection) return state;
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
        binderSlots: state.binderSlots.filter(s => s.collectionId !== collectionId),
        bin: [...state.bin, { ...collection, _type: 'collection', deletedAt: Date.now() }],
        nav: state.nav.currentView === 'collection' && state.nav.currentCollectionId === collectionId
          ? { ...state.nav, currentView: 'collections', currentCollectionId: null }
          : state.nav,
      };
    }
    // === ISSUE #57 END ===

    // ── Template Fields ───────────────────────────────────────────────────────

    case ACTIONS.TEMPLATE_FIELD_ADD:
      return { ...state, templateFields: [...state.templateFields, action.payload] };

    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      const collectionId = action.payload[0]?.collectionId;
      if (!collectionId) {
        console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD: missing collectionId');
        return state;
      }
      const { valid, error } = validateOneTemplatePerCollection(collectionId, state.templateFields);
      if (!valid) {
        console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD rejected:', error);
        return state;
      }
      return { ...state, templateFields: [...state.templateFields, ...action.payload] };
    }

    case ACTIONS.TEMPLATE_FIELD_UPDATE:
      return {
        ...state,
        templateFields: state.templateFields.map(f =>
          f.id === action.payload.id ? { ...f, ...action.payload } : f
        ),
      };

    case ACTIONS.TEMPLATE_FIELD_REORDER: {
      const { collectionId, fieldId, direction } = action.payload;
      const collectionFields = state.templateFields
        .filter(f => f.collectionId === collectionId)
        .sort((a, b) => a.order - b.order);
      const idx = collectionFields.findIndex(f => f.id === fieldId);
      if (idx === -1) return state;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= collectionFields.length) return state;
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

    // === ISSUE #57 START: CARD_DEFINITION_DELETE — send to bin ===
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload;
      const cardDef = state.cardDefinitions.find(cd => cd.id === cardDefId);
      if (!cardDef) return state;
      return {
        ...state,
        inventory: state.inventory.filter(inv => inv.cardDefId !== cardDefId),
        binderSlots: state.binderSlots.filter(s => s.cardDefId !== cardDefId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== cardDefId),
        bin: [...state.bin, { ...cardDef, _type: 'cardDef', deletedAt: Date.now() }],
      };
    }
    // === ISSUE #57 END ===

    // ── Inventory ─────────────────────────────────────────────────────────────

    case ACTIONS.INVENTORY_ADD:
      if (state.inventory.some(inv => inv.cardDefId === action.payload.cardDefId)) {
        console.warn('[BinderVault] INVENTORY_ADD: card already owned', action.payload.cardDefId);
        return state;
      }
      return { ...state, inventory: [...state.inventory, action.payload] };

    case ACTIONS.INVENTORY_UPDATE:
      return {
        ...state,
        inventory: state.inventory.map(inv =>
          inv.id === action.payload.id
            ? { ...inv, ...action.payload, updatedAt: Date.now() }
            : inv
        ),
      };

    case ACTIONS.INVENTORY_DELETE:
      return {
        ...state,
        inventory: state.inventory.filter(inv => inv.id !== action.payload.inventoryId),
      };

    // === ISSUE #53 START: Binder Slot Entity — reducer cases ===

    case ACTIONS.BINDER_SLOT_ADD: {
      const { slot } = action.payload;
      // Guard: prevent duplicate slots on same page/position
      const duplicate = state.binderSlots.some(
        s => s.binderId === slot.binderId &&
             s.pageNumber === slot.pageNumber &&
             s.slotIndex === slot.slotIndex
      );
      if (duplicate) {
        console.warn('[BinderVault] BINDER_SLOT_ADD: slot already occupied', slot);
        return state;
      }
      // Guard: prevent same card in two slots in same binder
      const alreadyPlaced = state.binderSlots.some(
        s => s.binderId === slot.binderId && s.cardDefId === slot.cardDefId
      );
      if (alreadyPlaced) {
        console.warn('[BinderVault] BINDER_SLOT_ADD: card already in binder', slot.cardDefId);
        return state;
      }
      return { ...state, binderSlots: [...state.binderSlots, slot] };
    }

    case ACTIONS.BINDER_SLOT_REMOVE:
      return {
        ...state,
        binderSlots: state.binderSlots.filter(s => s.id !== action.payload.slotId),
      };

    case ACTIONS.BINDER_SLOT_MOVE: {
      // Move a card to a different page/slot within the same binder
      const { slotId, pageNumber, slotIndex } = action.payload;
      // Check target is not already occupied
      const targetSlot = state.binderSlots.find(
        s => s.binderId === state.binderSlots.find(x => x.id === slotId)?.binderId &&
             s.pageNumber === pageNumber &&
             s.slotIndex === slotIndex
      );
      if (targetSlot) {
        console.warn('[BinderVault] BINDER_SLOT_MOVE: target slot occupied');
        return state;
      }
      return {
        ...state,
        binderSlots: state.binderSlots.map(s =>
          s.id === slotId ? { ...s, pageNumber, slotIndex } : s
        ),
      };
    }

    // === ISSUE #53 END: Binder Slot Entity ===

    default:
      console.warn('[BinderVault] Unknown action type:', action.type);
      return state;
  }
}