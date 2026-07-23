/**
 * @fileoverview binReducer — Trash — restoring a soft-deleted binder/collection/card/insert, permanently deleting one item, or emptying the whole bin.
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

export function binReducer(state, action) {
  switch (action.type) {


    case ACTIONS.BIN_RESTORE_BINDER: {
      const { itemId } = action.payload;
      const item = state.bin.find(b => b.id === itemId && b._type === 'binder');
      if (!item) return state;
      const { _type, deletedAt: _deletedAt, ...binder } = item;
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
      const { _type, deletedAt: _deletedAt, _cardDefs, _templateFields, _inventoryItems, ...collection } = item;
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
    // === Also fixes the matching half of the multi-copy bug above —
    // this used to only restore _inventoryItem (singular), so even
    // once the delete side is fixed to capture every copy, restoring
    // would still have only brought back one of them. ===

    case ACTIONS.BIN_RESTORE_CARD: {
      const { itemId } = action.payload;
      const item = state.bin.find(c => c.id === itemId && c._type === 'cardDef');
      if (!item) return state;
      const { _type, deletedAt: _deletedAt, _inventoryItems, ...cardDef } = item;
      return {
        ...state,
        cardDefinitions: [...state.cardDefinitions, cardDef],
        inventory: _inventoryItems
          ? [...state.inventory, ..._inventoryItems]
          : state.inventory,
        bin: state.bin.filter(c => c.id !== itemId),
      };
    }

    // === Quantity tracking: restore a single removed copy ===
    // === REMOVED: BIN_RESTORE_INVENTORY_ITEM — unreachable now that
    // INVENTORY_DELETE is back to a direct hard delete (see that
    // case's own comment for why). Nothing ever dispatches this
    // action anymore. ===

    // === Michi Method support: restore a decluttered/deleted library
    // image. Panels that had their insertId cleared when this image
    // was soft-deleted (see BINDER_INSERT_DELETE below) stay blank —
    // same reasoning as card declutter not attempting to recreate old
    // binder placements: there's no reliable way to know which panel
    // used to show this image once that link is gone.

    case ACTIONS.BIN_RESTORE_INSERT: {
      const { itemId } = action.payload;
      const item = state.bin.find(i => i.id === itemId && i._type === 'insert');
      if (!item) return state;
      const { _type, deletedAt: _deletedAt, ...insert } = item;
      return {
        ...state,
        binderInserts: [...state.binderInserts, insert],
        bin: state.bin.filter(i => i.id !== itemId),
      };
    }


    case ACTIONS.BIN_DELETE_ITEM: {
      // === FIX (real gap): this used to only clear state.bin itself,
      // leaving cardDefinitions/binderSlots/binders/collections
      // completely untouched locally — the server-side cascade (see
      // supabaseSync.js) is correct, but local state relied entirely
      // on an eventual realtime-triggered hydrate to catch up. Any
      // gap in that timing left orphaned binderSlots in memory,
      // referencing a card that's already gone — rendering blank but
      // still "occupying" that position (see the orphan-aware fix on
      // BINDER_SLOT_ADD above, which is the defensive half of this
      // same fix). This is the proactive half: mirror what
      // CARD_DEFINITION_DELETE already does correctly, immediately,
      // rather than waiting on a network round-trip to fix it.
      const { itemId } = action.payload;
      const binItem = state.bin.find(b => b.id === itemId);
      if (!binItem) return { ...state, bin: state.bin.filter(b => b.id !== itemId) };

      if (binItem._type === 'cardDef') {
        return {
          ...state,
          inventory:       state.inventory.filter(inv => inv.cardDefId !== itemId),
          binderSlots:     state.binderSlots.filter(s => s.cardDefId !== itemId),
          binderPanels:    state.binderPanels.filter(p => p.cardDefId !== itemId),
          cardDefinitions: state.cardDefinitions.filter(cd => cd.id !== itemId),
          bin:             state.bin.filter(b => b.id !== itemId),
        };
      }
      if (binItem._type === 'binder') {
        return {
          ...state,
          binderSlots:  state.binderSlots.filter(s => s.binderId !== itemId),
          binderPanels: state.binderPanels.filter(p => p.binderId !== itemId),
          binders:      state.binders.filter(b => b.id !== itemId),
          bin:          state.bin.filter(b => b.id !== itemId),
        };
      }
      if (binItem._type === 'collection') {
        const cardIdsInCollection = state.cardDefinitions
          .filter(cd => cd.collectionId === itemId)
          .map(cd => cd.id);
        return {
          ...state,
          inventory:       state.inventory.filter(inv => !cardIdsInCollection.includes(inv.cardDefId)),
          binderSlots:     state.binderSlots.filter(s => !cardIdsInCollection.includes(s.cardDefId)),
          binderPanels:    state.binderPanels.filter(p => !cardIdsInCollection.includes(p.cardDefId)),
          cardDefinitions: state.cardDefinitions.filter(cd => cd.collectionId !== itemId),
          templateFields:  state.templateFields.filter(f => f.collectionId !== itemId),
          collections:     state.collections.filter(c => c.id !== itemId),
          bin:             state.bin.filter(b => b.id !== itemId),
        };
      }
      return { ...state, bin: state.bin.filter(b => b.id !== itemId) };
    }


    case ACTIONS.BIN_EMPTY:
      return { ...state, bin: [] };
    default:
      return state;
  }
}
