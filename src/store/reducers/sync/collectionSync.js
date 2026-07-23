/**
 * @fileoverview collectionSync — Supabase sync for the collection domain.
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
import { getRealUserId, upsertCollection, upsertBinItem } from './syncHelpers.js';

export function collectionSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.COLLECTION_ADD:
    case ACTIONS.COLLECTION_UPDATE: {
      const col = nextState.collections.find(c => c.id === action.payload.id);
      if (col) pending.push(upsertCollection(col));
      break;
    }
    case ACTIONS.COLLECTION_DELETE: {
      const { collectionId } = action.payload ?? {};
      if (collectionId) {
        const now = new Date().toISOString();
        pending.push(getRealUserId().then(async userId => {
          if (!userId) return;
          await supabase.from('collections').update({ deleted_at: now }).eq('id', collectionId).eq('user_id', userId);
          const { data: cds } = await supabase.from('card_definitions').select('id').eq('collection_id', collectionId).eq('user_id', userId);
          if (cds?.length) {
            const cdIds = cds.map(c => c.id);
            await supabase.from('card_definitions').update({ deleted_at: now }).in('id', cdIds).eq('user_id', userId);
            await supabase.from('user_inventory').update({ deleted_at: now }).in('card_def_id', cdIds).eq('user_id', userId);
          }
        }));
        const binItem = nextState.bin.find(b => b.id === collectionId);
        if (binItem) pending.push(upsertBinItem(binItem, 'collection'));
      }
      break;
    }
    default:
      break;
  }
}
