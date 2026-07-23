/**
 * @fileoverview templateFieldSync — Supabase sync for the templateField domain.
 *
 * Split out of the monolithic supabaseSync.js (was a single ~850-
 * line, 39-case switch statement) for scalability, matching the same
 * domain split done for the reducer itself (store/reducers/). Each
 * function here has the same shape the original switch cases did:
 * push zero or more pending write promises onto the shared `pending`
 * array passed in — nothing is returned, since the root
 * supabaseSync.js awaits everything collected across every domain
 * together at the end via Promise.allSettled.
 */

import { ACTIONS } from '../../actionTypes.js';
import { upsertTemplateField } from './syncHelpers.js';

export function templateFieldSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.TEMPLATE_FIELD_ADD:
    case ACTIONS.TEMPLATE_FIELD_UPDATE: {
      const field = nextState.templateFields.find(f => f.id === action.payload.id);
      if (field) pending.push(upsertTemplateField(field));
      break;
    }
    case ACTIONS.TEMPLATE_FIELD_BULK_ADD: {
      (action.payload ?? []).forEach(f => {
        const field = nextState.templateFields.find(tf => tf.id === f.id);
        if (field) pending.push(upsertTemplateField(field));
      });
      break;
    }
    case ACTIONS.TEMPLATE_FIELD_REORDER: {
      nextState.templateFields
        .filter(f => f.collectionId === action.payload?.collectionId)
        .forEach(f => pending.push(upsertTemplateField(f)));
      break;
    }
    default:
      break;
  }
}
