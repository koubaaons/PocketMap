/**
 * @fileoverview cardDefinitionSync — Supabase sync for the cardDefinition domain.
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
import { upsertCardDefinition, upsertBinItem } from './syncHelpers.js';

export function cardDefinitionSync(action, nextState, prevState, pending) {
  switch (action.type) {

    case ACTIONS.CARD_DEFINITION_ADD:
    case ACTIONS.CARD_DEFINITION_UPDATE: {
      const cd = nextState.cardDefinitions.find(c => c.id === action.payload.id);
      if (cd) pending.push(upsertCardDefinition(cd));
      break;
    }
    case ACTIONS.CARD_DEFINITION_BULK_ADD: {
      // === FIX (real bug: bulk imports silently losing roughly half
      // their cards): this used to fire every card's upsert via
      // .forEach with no sequencing at all — a burst of 30+ writes
      // hitting Supabase essentially simultaneously. That's exactly
      // the kind of load that can silently drop some writes (a
      // connection-pool limit, a rate limit, a timeout under
      // concurrent load) — and there was no way to notice, since
      // local state already shows all the cards regardless of
      // whether their individual database write actually landed.
      // Sequential writes (one at a time, not fire-and-forget in a
      // loop) are slower for a large import but far more reliable —
      // matches the same reasoning already used for the Pokémon API's
      // own fetch pagination (sequential, not parallel, to respect
      // its rate limit). Wrapped in an IIFE so this case can await
      // inside a switch without restructuring the whole function.
      const cardsToUpsert = (action.payload ?? [])
        .map(c => nextState.cardDefinitions.find(d => d.id === c.id))
        .filter(Boolean);
      pending.push((async () => {
        for (const cd of cardsToUpsert) {
          await upsertCardDefinition(cd);
        }
      })());
      break;
    }
    case ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED: {
      const { ids = [], isDecluttered } = action.payload ?? {};
      const idSet = new Set(ids);
      const cards = nextState.cardDefinitions.filter(cd => idSet.has(cd.id));

      // Decluttering (not restoring) also strips any binder
      // placements for these cards — see reducer.js's own comment on
      // this action for why. Computed from prevState since nextState
      // no longer has them.
      const removedSlotIds = isDecluttered
        ? prevState.binderSlots.filter(s => idSet.has(s.cardDefId)).map(s => s.id)
        : [];
      const removedPanelIds = isDecluttered
        ? prevState.binderPanels.filter(p => p.panelType === 'card' && idSet.has(p.cardDefId)).map(p => p.id)
        : [];

      pending.push((async () => {
        for (const cd of cards) await upsertCardDefinition(cd);
        for (const id of removedSlotIds) {
          const { error } = await supabase.from('binder_slots').delete().eq('id', id);
          if (error) console.error('[Sync] binder slot removal (declutter) failed:', error);
        }
        for (const id of removedPanelIds) {
          const { error } = await supabase.from('binder_panels').delete().eq('id', id);
          if (error) console.error('[Sync] binder panel removal (declutter) failed:', error);
        }
      })());
      break;
    }
    case ACTIONS.CARD_DEFINITION_DELETE: {
      const { cardDefId } = action.payload ?? {};
      if (cardDefId) {
        const now = new Date().toISOString();
        pending.push(
          supabase.from('card_definitions').update({ deleted_at: now }).eq('id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Sync] card soft delete failed:', error); })
        );
        pending.push(
          supabase.from('user_inventory').update({ deleted_at: now }).eq('card_def_id', cardDefId)
            .then(({ error }) => { if (error) console.error('[Sync] inventory soft delete failed:', error); })
        );
        const binItem = nextState.bin.find(b => b.id === cardDefId);
        if (binItem) pending.push(upsertBinItem(binItem, 'cardDef'));
      }
      break;
    }
    default:
      break;
  }
}
