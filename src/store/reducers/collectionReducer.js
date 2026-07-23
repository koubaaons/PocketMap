/**
 * @fileoverview collectionReducer — Collections — create/update/soft-delete a collection.
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

export function collectionReducer(state, action) {
  switch (action.type) {


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
        binderPanels:    state.binderPanels.filter(p => !affectedCardDefIds.has(p.cardDefId)),
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
    default:
      return state;
  }
}
