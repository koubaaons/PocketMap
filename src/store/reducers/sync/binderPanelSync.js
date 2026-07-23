/**
 * @fileoverview binderPanelSync — Supabase sync for the binderPanel domain.
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
import { upsertBinderPanel, deleteBinderPanel } from './syncHelpers.js';

export function binderPanelSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.BINDER_PANEL_ADD: {
      const panel = nextState.binderPanels.find(p => p.id === action.payload.id);
      if (panel) pending.push(upsertBinderPanel(panel));
      break;
    }
    case ACTIONS.BINDER_PANEL_UPDATE: {
      const panel = nextState.binderPanels.find(p => p.id === action.payload.id);
      if (panel) pending.push(upsertBinderPanel(panel));
      break;
    }
    case ACTIONS.BINDER_PANEL_REMOVE: {
      if (action.payload?.panelId) pending.push(deleteBinderPanel(action.payload.panelId));
      break;
    }
    default:
      break;
  }
}
