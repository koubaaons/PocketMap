/**
 * @fileoverview binderSync — Supabase sync for the binder domain.
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
import { supabase } from '../../../services/supabase.js';
import { getStoragePathFromUrl, deleteImageFromStorage } from '../../../utils/supabaseImageUpload.js';
import { upsertBinder, upsertBinderSlot, upsertBinderPanel, upsertBinItem } from './syncHelpers.js';

export function binderSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.BINDER_ADD:
    case ACTIONS.BINDER_UPDATE:
    case ACTIONS.BINDER_ADD_PAGE: {
      const binder = nextState.binders.find(
        b => b.id === (action.payload.id ?? action.payload.binderId)
      );
      if (binder) {
        pending.push(upsertBinder(binder));
        const prevBinder = prevState.binders.find(b => b.id === binder.id);
        const prevUrls = new Set((prevBinder?.stickers ?? []).map(s => s.image_url));
        const nextUrls = new Set((binder.stickers ?? []).map(s => s.image_url));
        for (const url of prevUrls) {
          if (!nextUrls.has(url)) {
            pending.push(deleteImageFromStorage(getStoragePathFromUrl(url)));
          }
        }
      }
      break;
    }
    // === New: Swap Pages — could touch a full page's worth of slots
    // and panels at once, same "don't fire a burst of simultaneous
    // writes" reasoning as CARD_DEFINITION_BULK_ADD above (see that
    // case's own comment for the full explanation of why sequential,
    // not parallel).
    case ACTIONS.BINDER_SWAP_PAGES: {
      const { binderId, pageA, pageB } = action.payload ?? {};
      if (!binderId || pageA == null || pageB == null || pageA === pageB) break;

      const affectedSlots = nextState.binderSlots.filter(
        s => s.binderId === binderId && (s.pageNumber === pageA || s.pageNumber === pageB)
      );
      const affectedPanels = nextState.binderPanels.filter(
        p => p.binderId === binderId && (p.pageNumber === pageA || p.pageNumber === pageB)
      );

      pending.push((async () => {
        for (const slot of affectedSlots) await upsertBinderSlot(slot);
        for (const panel of affectedPanels) await upsertBinderPanel(panel);
      })());
      break;
    }
    case ACTIONS.BINDER_DELETE: {
      const { binderId } = action.payload ?? {};
      if (binderId) {
        pending.push(
          supabase.from('binders')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', binderId)
            .then(({ error }) => { if (error) console.error('[Sync] binder soft delete failed:', error); })
        );
        const binItem = nextState.bin.find(b => b.id === binderId);
        if (binItem) pending.push(upsertBinItem(binItem, 'binder'));
      }
      break;
    }
    default:
      break;
  }
}
