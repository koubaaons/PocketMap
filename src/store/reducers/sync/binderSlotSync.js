/**
 * @fileoverview binderSlotSync — Supabase sync for the binderSlot domain.
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
import { upsertBinderSlot, deleteBinderSlot } from './syncHelpers.js';

export function binderSlotSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.BINDER_SLOT_ADD: {
      const slot = nextState.binderSlots.find(s => s.id === action.payload?.slot?.id);
      if (slot) pending.push(upsertBinderSlot(slot));
      break;
    }
    case ACTIONS.BINDER_SLOT_MOVE: {
      const slot = nextState.binderSlots.find(s => s.id === action.payload?.slotId);
      if (slot) pending.push(upsertBinderSlot(slot));
      break;
    }
    case ACTIONS.BINDER_SLOT_REMOVE: {
      if (action.payload?.slotId) pending.push(deleteBinderSlot(action.payload.slotId));
      break;
    }

    // ── Michi Method support: combined slots ──────────────────────────────────
    default:
      break;
  }
}
