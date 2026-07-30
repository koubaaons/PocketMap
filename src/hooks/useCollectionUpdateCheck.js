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
 *
 * === Also backfills missing card images ===
 * A card can have no image at import time simply because the
 * provider hadn't been given that artwork yet — TCGdex is an open,
 * community-maintained database that receives image contributions on
 * an ongoing basis, so "missing today" doesn't mean "missing forever".
 * This rides along on the exact same per-collection apiCards fetch
 * this hook already does for the new-cards check, at no extra
 * network cost — for every owned card with no image_url, it checks
 * whether the provider now has one and fills it in via a normal
 * CARD_DEFINITION_UPDATE if so. Never touches a card that already has
 * an image.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './useAuth.js';
import { useDispatch } from './useStore.js';
import { ACTIONS } from '../store/index.js';
import { getUserPreferences, recordCollectionUpdateCheck } from '../services/userPreferences.js';
import { fetchAllCardsForSet, mapCardToDraft, PROVIDER_KEY } from '../services/activeProvider.js';
import { importNewCardsForCollection, uploadCardImageIfAvailable } from '../services/tcgImport.js';

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
            const apiCardsByExternalId = new Map(apiCards.map(c => [c.id, c]));

            const collectionCardDefs = cardDefinitions.filter(cd => cd.collectionId === collection.id);
            const alreadyHaveIds = new Set(
              collectionCardDefs.filter(cd => cd.external_card_id).map(cd => cd.external_card_id)
            );
            const knownIds = new Set([...(collection.known_external_card_ids ?? []), ...alreadyHaveIds]);

            const newCards = apiCards.filter(c => !knownIds.has(c.id));
            if (newCards.length > 0) {
              results.push({ collectionId: collection.id, collectionName: collection.name, newCards });
            }

            // === Backfill missing images ===
            // TCGdex is an open, community-maintained database that
            // gets image contributions on an ongoing basis — a card
            // with no image at import time isn't necessarily missing
            // it forever. This rides along on the exact same apiCards
            // fetch the new-cards check above already needed, so it
            // costs nothing extra in requests. Only ever fills in an
            // image where one is now genuinely available; never
            // touches a card that already has one.
            for (const cardDef of collectionCardDefs) {
              if (cardDef.image_url || !cardDef.external_card_id) continue;
              const apiCard = apiCardsByExternalId.get(cardDef.external_card_id);
              if (!apiCard) continue;

              try {
                const draft = mapCardToDraft(apiCard);
                const newImageUrl = await uploadCardImageIfAvailable(draft.sourceImageUrl);
                if (newImageUrl) {
                  dispatch({ type: ACTIONS.CARD_DEFINITION_UPDATE, payload: { id: cardDef.id, image_url: newImageUrl } });
                }
              } catch (err) {
                // One card's image failing to backfill shouldn't stop
                // the rest from being checked.
                console.error(`[useCollectionUpdateCheck] image backfill failed for card ${cardDef.id}:`, err);
              }
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
