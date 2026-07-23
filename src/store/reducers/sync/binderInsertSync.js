/**
 * @fileoverview binderInsertSync — Supabase sync for the binderInsert domain.
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
import { getRealUserId, upsertBinderInsert, upsertBinItem } from './syncHelpers.js';

export function binderInsertSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.BINDER_INSERT_ADD: {
      const insert = nextState.binderInserts.find(i => i.id === action.payload.id);
      if (insert) pending.push(upsertBinderInsert(insert));
      break;
    }
    case ACTIONS.BINDER_INSERT_BULK_ADD: {
      const newIds = new Set((action.payload ?? []).map(i => i.id));
      const inserts = nextState.binderInserts.filter(i => newIds.has(i.id));
      pending.push((async () => {
        for (const insert of inserts) await upsertBinderInsert(insert);
      })());
      break;
    }
    // === CHANGED: soft delete (matches reducer.js's own change) —
    // marks deleted_at instead of removing the row, and mirrors it
    // into the bin table so it shows up in Trash. Also syncs the
    // insertId-cleared panels the reducer produces, the same
    // diff-against-prevState approach used for slot/panel
    // auto-link/unlink elsewhere in this file.
    case ACTIONS.BINDER_INSERT_DELETE: {
      const { insertId } = action.payload ?? {};
      if (insertId) {
        const deletedInsert = prevState.binderInserts.find(i => i.id === insertId);
        pending.push(
          supabase.from('binder_inserts').update({ deleted_at: new Date().toISOString() }).eq('id', insertId)
            .then(({ error }) => { if (error) console.error('[Sync] insert soft delete failed:', error); })
        );
        if (deletedInsert) {
          const binItem = nextState.bin.find(b => b.id === insertId);
          if (binItem) pending.push(upsertBinItem(binItem, 'insert'));
        }
        const clearedPanels = nextState.binderPanels.filter(p => {
          const prev = prevState.binderPanels.find(pp => pp.id === p.id);
          return prev && prev.insertId === insertId && p.insertId === null;
        });
        for (const panel of clearedPanels) {
          pending.push(
            supabase.from('binder_panels').update({ insert_id: null }).eq('id', panel.id)
              .then(({ error }) => { if (error) console.error('[Sync] panel insert-clear (declutter image) failed:', error); })
          );
        }
      }
      break;
    }
    case ACTIONS.BINDER_INSERT_BULK_DELETE: {
      const insertIds = action.payload?.insertIds ?? [];
      const idSet = new Set(insertIds);

      const clearedPanels = nextState.binderPanels.filter(p => {
        const prev = prevState.binderPanels.find(pp => pp.id === p.id);
        return prev && idSet.has(prev.insertId) && p.insertId === null;
      });

      pending.push((async () => {
        for (const insertId of insertIds) {
          const { error } = await supabase.from('binder_inserts').update({ deleted_at: new Date().toISOString() }).eq('id', insertId);
          if (error) console.error('[Sync] insert bulk soft delete failed:', error);
        }
        for (const panel of clearedPanels) {
          const { error } = await supabase.from('binder_panels').update({ insert_id: null }).eq('id', panel.id);
          if (error) console.error('[Sync] panel insert-clear (bulk declutter image) failed:', error);
        }
      })());

      pending.push(getRealUserId().then(async userId => {
        if (!userId) return;
        for (const insertId of insertIds) {
          const binItem = nextState.bin.find(b => b.id === insertId);
          if (binItem) await upsertBinItem(binItem, 'insert');
        }
      }));
      break;
    }
    default:
      break;
  }
}
