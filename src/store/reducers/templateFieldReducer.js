/**
 * @fileoverview templateFieldReducer — A collection's custom template fields (the per-collection schema — rarity, holo type, custom attributes, etc).
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
import { validateOneTemplatePerCollection } from '../../types/index.js';

export function templateFieldReducer(state, action) {
  switch (action.type) {


    case ACTIONS.TEMPLATE_FIELD_ADD:
      return { ...state, templateFields: [...state.templateFields, action.payload] };


    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      const collectionId = action.payload[0]?.collectionId;
      if (!collectionId) { console.warn('[Pinder] TEMPLATE_FIELD_BULK_ADD: missing collectionId'); return state; }
      const { valid, error } = validateOneTemplatePerCollection(collectionId, state.templateFields);
      if (!valid) { console.warn('[Pinder] TEMPLATE_FIELD_BULK_ADD rejected:', error); return state; }
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
    default:
      return state;
  }
}
