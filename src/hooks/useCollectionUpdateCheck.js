/**
 * @fileoverview useCollectionUpdateCheck — detects new cards added to
 * a set the account has already imported (e.g. a delayed secret rare
 * reveal, errata), and offers to add just those new cards as unowned
 * — leaving every existing card's ownership, favorites, and binder
 * placements completely untouched.
 *
 * Same check-on-open reasoning as useNewSetCheck.js: the only thing
 * this needs to deliver is an in-app prompt the next time someone
 * opens the app, so a real scheduled server-side job would be real
 * infrastructure for no benefit nobody would see any sooner.
 *
 * Matches cards by external_card_id (the API's own stable id for that
 * card), not by name — two cards can legitimately share a name
 * (reprints, alternate arts), so name-matching risks either treating
 * two different cards as the same one or missing a genuine duplicate.
 *
 * A collection's known_external_card_ids (every external id it's ever
 * been shown, whether imported or dismissed) is unioned with the ids
 * of cards it actually has, and diffed against the API's current
 * list — anything left over is genuinely new. Regardless of outcome,
 * every checked collection's known_external_card_ids is updated to
 * the full current list, so a dismissed notification doesn't reappear
 * on tomorrow's check.
 *
 * known_external_card_ids lives on the collection itself, which is
 * part of the app's normal store/reducer/sync pipeline — updating it
 * goes through a real COLLECTION_UPDATE dispatch, not a separate raw
 * Supabase write, so local state and the synced copy never disagree.
 *
 * Only checks collections whose provider_key matches whichever
 * provider is currently active — a collection imported under a
 * DIFFERENT (old, now-inactive) provider is skipped rather than
 * attempted, since its external_set_id/card ids belong to an ID
 * scheme the current provider has no way to understand. A missing
 * provider_key (collections created before this field existed) is
 * treated as matching the current provider — safe today, since
 * there's only ever been one, but this stops applying the moment a
 * second provider is introduced, which is why every new collection is
 * explicitly stamped with its real provider_key going forward.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './useAuth.js';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { getUserPreferences, recordCollectionUpdateCheck } from '../services/userPreferences.js';
import { fetchAllCardsForSet, PROVIDER_KEY } from '../services/activeProvider.js';
import { importNewCardsForCollection } from '../services/tcgImport.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

/**
 * @param {{ syncing: boolean, collections: object[], cardDefinitions: object[] }} params
 * @returns {{
 *   pendingUpdates: { collectionId: string, collectionName: string, newCards: object[] }[],
 *   dismiss: (collectionId: string) => void,
 *   importNewCards: (collectionId: string) => Promise<{ added: number, failures: object[] }|undefined>,
 * }}
 */
export function useCollectionUpdateCheck({ syncing, collections, cardDefinitions }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (syncing || !user || hasRunRef.current) return;
    hasRunRef.current = true;

    (async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        const lastChecked = prefs.lastCollectionUpdateCheckAt ? new Date(prefs.lastCollectionUpdateCheckAt).getTime() : null;
        const dueForCheck = !lastChecked || (Date.now() - lastChecked) >= CHECK_INTERVAL_MS;
        if (!dueForCheck) return;

        const importedCollections = collections.filter(
          c => c.external_set_id && (c.provider_key ?? PROVIDER_KEY) === PROVIDER_KEY
        );
        const results = [];

        // Sequential, not parallel — same rate-limit courtesy as
        // fetchAllCardsForSet's own multi-page fetching.
        for (const collection of importedCollections) {
          try {
            const apiCards = await fetchAllCardsForSet(collection.external_set_id);

            const alreadyHaveIds = new Set(
              cardDefinitions
                .filter(cd => cd.collectionId === collection.id && cd.external_card_id)
                .map(cd => cd.external_card_id)
            );
            const knownIds = new Set([...(collection.known_external_card_ids ?? []), ...alreadyHaveIds]);

            const newCards = apiCards.filter(c => !knownIds.has(c.id));
            if (newCards.length > 0) {
              results.push({ collectionId: collection.id, collectionName: collection.name, newCards });
            }

            // Regardless of outcome, record everything currently
            // visible as known — through the real dispatch pipeline,
            // not a side-channel write, so local state stays correct.
            const updatedKnownIds = [...new Set([...knownIds, ...apiCards.map(c => c.id)])];
            dispatch({ type: ACTIONS.COLLECTION_UPDATE, payload: { id: collection.id, known_external_card_ids: updatedKnownIds } });
          } catch (err) {
            console.error(`[useCollectionUpdateCheck] check failed for collection ${collection.id}:`, err);
          }
        }

        if (results.length > 0) setPendingUpdates(results);
        await recordCollectionUpdateCheck(user.id);
      } catch (err) {
        console.error('[useCollectionUpdateCheck] check failed:', err);
      }
    })();
  }, [syncing, user, collections, cardDefinitions, dispatch]);

  const dismiss = useCallback((collectionId) => {
    setPendingUpdates(prev => prev.filter(p => p.collectionId !== collectionId));
  }, []);

  const importNewCards = useCallback(async (collectionId) => {
    const entry = pendingUpdates.find(p => p.collectionId === collectionId);
    if (!entry) return;

    const { cardDefinitions: newCardDefs, failures } = await importNewCardsForCollection(collectionId, entry.newCards);
    if (newCardDefs.length > 0) {
      dispatch({ type: ACTIONS.CARD_DEFINITION_BULK_ADD, payload: newCardDefs });
    }
    dismiss(collectionId);
    return { added: newCardDefs.length, failures };
  }, [pendingUpdates, dispatch, dismiss]);

  return { pendingUpdates, dismiss, importNewCards };
}
