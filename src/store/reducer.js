/**
 * @fileoverview Pure reducer — all state transitions live here.
 * No side effects. No localStorage, no DOM, no fetch.
 */

import { validateOneTemplatePerCollection } from '../types/index.js';

export const ACTIONS = Object.freeze({
  BINDER_ADD:      'BINDER_ADD',
  BINDER_UPDATE:   'BINDER_UPDATE',
  BINDER_DELETE:   'BINDER_DELETE',
  BINDER_ADD_PAGE: 'BINDER_ADD_PAGE',
  BIN_RESTORE_BINDER:     'BIN_RESTORE_BINDER',
  BIN_RESTORE_COLLECTION: 'BIN_RESTORE_COLLECTION',
  BIN_RESTORE_CARD:       'BIN_RESTORE_CARD',
  BIN_DELETE_ITEM:        'BIN_DELETE_ITEM',
  BIN_EMPTY:              'BIN_EMPTY',
  NAV_SET: 'NAV_SET',
  COLLECTION_ADD:    'COLLECTION_ADD',
  COLLECTION_UPDATE: 'COLLECTION_UPDATE',
  COLLECTION_DELETE: 'COLLECTION_DELETE',
  TEMPLATE_FIELD_ADD:      'TEMPLATE_FIELD_ADD',
  TEMPLATE_FIELD_BULK_ADD: 'TEMPLATE_FIELD_BULK_ADD',
  TEMPLATE_FIELD_UPDATE:   'TEMPLATE_FIELD_UPDATE',
  TEMPLATE_FIELD_REORDER:  'TEMPLATE_FIELD_REORDER',
  CARD_DEFINITION_ADD:      'CARD_DEFINITION_ADD',
  CARD_DEFINITION_BULK_ADD: 'CARD_DEFINITION_BULK_ADD',
  CARD_DEFINITION_UPDATE:   'CARD_DEFINITION_UPDATE',
  CARD_DEFINITION_DELETE:   'CARD_DEFINITION_DELETE',
  INVENTORY_ADD:    'INVENTORY_ADD',
  INVENTORY_UPDATE: 'INVENTORY_UPDATE',
  INVENTORY_DELETE: 'INVENTORY_DELETE',
  BINDER_SLOT_ADD:    'BINDER_SLOT_ADD',
  BINDER_SLOT_REMOVE: 'BINDER_SLOT_REMOVE',
  BINDER_SLOT_MOVE:   'BINDER_SLOT_MOVE',
});

export function reducer(state, action) {
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
        bin: [...state.bin, { ...binder, _type: 'binder', deletedAt: Date.now() }],
        nav: state.nav.currentView === 'binder' && state.nav.currentBinderId === binderId
          ? { ...state.nav, currentView: 'home', currentBinderId: null, currentPage: 1 }
          : state.nav,
      };
    }

    case ACTIONS.BINDER_ADD_PAGE:
      return {
        ...state,
        binders: state.binders.map(b =>
          b.id === action.payload.binderId ? { ...b, pages: b.pages + 1 } : b
        ),
      };

    // ── Bin ───────────────────────────────────────────────────────────────────

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

    // === FIX4: restore collection with all cards, fields, and inventory ===
    case ACTIONS.BIN_RESTORE_COLLECTION: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'collection');
      if (!item) return state;
      const { _type, deletedAt, _cardDefs, _templateFields, _inventoryItems, ...collection } = item;
      return {
        ...state,
        collections:     [...state.collections, collection],
        cardDefinitions: _cardDefs       ? [...state.cardDefinitions, ..._cardDefs]      : state.cardDefinitions,
        templateFields:  _templateFields ? [...state.templateFields,  ..._templateFields] : state.templateFields,
        inventory:       _inventoryItems ? [...state.inventory,        ..._inventoryItems] : state.inventory,
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    // === FIX3: restore card with owned and favorite state ===
    case ACTIONS.BIN_RESTORE_CARD: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'cardDef');
      if (!item) return state;
      const { _type, deletedAt, _inventoryItem, ...cardDef } = item;
      return {
        ...state,
        cardDefinitions: [...state.cardDefinitions, cardDef],
        inventory: _inventoryItem
          ? [...state.inventory, _inventoryItem]
          : state.inventory,
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    case ACTIONS.BIN_DELETE_ITEM:
      return { ...state, bin: state.bin.filter(b => b.id !== action.payload.itemId) };

    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };

    case ACTIONS.NAV_SET:
      return { ...state, nav: { ...state.nav, ...action.payload } };

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

    // === FIX4: save cards, fields, inventory to bin on collection delete ===
    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload;
      const collection = state.collections.find(c => c.id === collectionId);
      if (!collection) return state;
      const affectedCardDefs      = state.cardDefinitions.filter(cd => cd.collectionId === collectionId);
      const affectedCardDefIds    = new Set(affectedCardDefs.map(cd => cd.id));
      const affectedTemplateFields = state.templateFields.filter(f => f.collectionId === collectionId);
      const affectedInventoryItems = state.inventory.filter(inv => affectedCardDefIds.has(inv.cardDefId));
      return {
        ...state,
        collections:     state.collections.filter(c => c.id !== collectionId),
        templateFields:  state.templateFields.filter(f => f.collectionId !== collectionId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.collectionId !== collectionId),
        inventory:       state.inventory.filter(inv => !affectedCardDefIds.has(inv.cardDefId)),
        binderSlots:     state.binderSlots.filter(s => s.collectionId !== collectionId),
        bin: [...state.bin, {
          ...collection,
          _type:           'collection',
          deletedAt:       Date.now(),
          _cardDefs:        affectedCardDefs,
          _templateFields:  affectedTemplateFields,
          _inventoryItems:  affectedInventoryItems,
        }],
        nav: state.nav.currentView === 'collection' && state.nav.currentCollectionId === collectionId
          ? { ...state.nav, currentView: 'collections', currentCollectionId: null }
          : state.nav,
      };
    }

    case ACTIONS.TEMPLATE_FIELD_ADD:
      return { ...state, templateFields: [...state.templateFields, action.payload] };

    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      const collectionId = action.payload[0]?.collectionId;
      if (!collectionId) { console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD: missing collectionId'); return state; }
      const { valid, error } = validateOneTemplatePerCollection(collectionId, state.templateFields);
      if (!valid) { console.warn('[BinderVault] TEMPLATE_FIELD_BULK_ADD rejected:', error); return state; }
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

    // === FIX3: save inventory item to bin alongside card def ===
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload;
      const cardDef = state.cardDefinitions.find(cd => cd.id === cardDefId);
      if (!cardDef) return state;
      const inventoryItem = state.inventory.find(inv => inv.cardDefId === cardDefId) ?? null;
      return {
        ...state,
        inventory:       state.inventory.filter(inv => inv.cardDefId !== cardDefId),
        binderSlots:     state.binderSlots.filter(s => s.cardDefId !== cardDefId),
        cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== cardDefId),
        bin: [...state.bin, {
          ...cardDef,
          _type:          'cardDef',
          deletedAt:      Date.now(),
          _inventoryItem: inventoryItem,
        }],
      };
    }

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

    case ACTIONS.BINDER_SLOT_ADD: {
      const { slot } = action.payload;
      const duplicate = state.binderSlots.some(
        s => s.binderId === slot.binderId && s.pageNumber === slot.pageNumber && s.slotIndex === slot.slotIndex
      );
      if (duplicate) { console.warn('[BinderVault] BINDER_SLOT_ADD: slot already occupied', slot); return state; }
      const alreadyPlaced = state.binderSlots.some(
        s => s.binderId === slot.binderId && s.cardDefId === slot.cardDefId
      );
      if (alreadyPlaced) { console.warn('[BinderVault] BINDER_SLOT_ADD: card already in binder', slot.cardDefId); return state; }
      return { ...state, binderSlots: [...state.binderSlots, slot] };
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

    default:
      console.warn('[BinderVault] Unknown action type:', action.type);
      return state;
  }
}