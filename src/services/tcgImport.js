/**
 * @fileoverview tcgImport — builds a full collection (collection +
 * template fields + card definitions) from one set, using whichever
 * provider is currently active.
 *
 * Extracted out of PokemonImportModal.jsx's handleConfirm, which used
 * to have this logic inline — fine when it was the only caller, but
 * the Seed Loader (#135) needs the exact same steps (fetch cards, map
 * each one, upload shared images, create card definitions, collect
 * partial failures) to run automatically in the background, with no
 * UI of its own. Having two copies of this logic would mean every
 * future fix (like the shared-image-path handling, or how partial
 * failures get reported) needing to happen twice and staying in sync
 * by hand — exactly the kind of duplication that quietly drifts.
 *
 * The manual import modal still owns its own UI (the progress bar,
 * the "importing…" modal) — it just calls this for the actual work,
 * passing an onProgress callback to drive that UI. The Seed Loader
 * calls the same function with no UI at all, just a toast once it's
 * done.
 */

import { createCollection, createTemplateField, createCardDefinition } from '../types/index.js';
import { fetchAllCardsForSet, mapCardToDraft, TEMPLATE_FIELDS, GAME_LABEL, PROVIDER_KEY } from './activeProvider.js';

/**
 * Uploads one card's image to Storage (shared path, cached across
 * every user — not per-user) if it's not already there, returning the
 * resulting URL. Returns null if sourceImageUrl is null (this card
 * genuinely has no image available from the provider yet).
 *
 * Takes the already-computed sourceImageUrl/cacheKey directly, rather
 * than the raw apiCard + re-deriving them via mapCardToDraft — the
 * caller has always already called mapCardToDraft once for its own
 * purposes, and calling it a second time here would be both wasted
 * work and, in tests, a second consumption of a mocked
 * once-per-card implementation.
 *
 * Extracted out of buildCollectionFromSet and importNewCardsForCollection,
 * which both had this exact logic duplicated inline — also used by
 * the "backfill missing images" pass in useCollectionUpdateCheck.js,
 * which re-checks cards that had no image at import time in case the
 * provider's data has since been filled in (TCGdex, being an open,
 * community-maintained database, gets image contributions on an
 * ongoing basis — a card missing art today isn't necessarily missing
 * it forever).
 */
/**
 * Returns the card's own TCGdex image URL directly, unchanged.
 *
 * === CHANGED: real bug fixed. This used to fetch() the image bytes
 * client-side and re-upload them to our own Supabase Storage, to
 * build a shared, deduplicated cache. But assets.tcgdex.net has no
 * CORS headers at all -- not missing for this specific domain,
 * missing entirely -- so that fetch() was blocked by every browser,
 * on every origin, including localhost. It just hadn't been caught:
 * earlier testing mostly touched cards that already had an image
 * cached in Storage from before this migration, so the failure
 * never surfaced clearly until a genuinely fresh import, with a
 * completely empty cache, hit every single card at once.
 *
 * The actual fix is also simpler than patching around the CORS
 * block: TCGdex already serves one stable, public URL per card to
 * everyone — that IS the shared, deduplicated copy. Mirroring it into
 * our own Storage was never actually buying anything beyond reduced
 * dependency on TCGdex's own uptime, which isn't worth the tradeoff
 * of imports being broken outright.
 */
export async function uploadCardImageIfAvailable(sourceImageUrl) {
  return sourceImageUrl ?? null;
}

/**
 * @param {object} set - one set object from the active provider's fetchAllSets()
 * @param {object} [opts]
 * @param {object[]} [opts.cards] - already-fetched cards for this set, if the
 *   caller has them (e.g. the import modal's preview fetch) — avoids
 *   re-fetching. If omitted, every card for the set is fetched here.
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @returns {Promise<{ collection: object, templateFields: object[], cardDefinitions: object[], failures: {name: string, error: string}[] }>}
 */
export async function buildCollectionFromSet(set, { cards, onProgress } = {}) {
  const cardList = cards ?? await fetchAllCardsForSet(set.id);

  const { collection, errors: collectionErrors } = createCollection({
    name: set.name,
    is_custom: false,
    import_source: `${GAME_LABEL}: ${set.name}`,
    cover_image_url: set.images?.logo ?? null,
    external_set_id: set.id,
    provider_key: PROVIDER_KEY,
  });
  if (!collection) throw new Error(`Collection creation failed: ${collectionErrors.join(', ')}`);

  const templateFields = TEMPLATE_FIELDS
    .map((f, idx) => createTemplateField({
      collectionId: collection.id,
      field_name: f.field_name,
      field_type: f.field_type,
      is_required: f.is_required,
      order: idx,
      options: f.options ?? [],
    }).field)
    .filter(Boolean);

  // Handle partial-failure gracefully — one card's image failing to
  // fetch/upload shouldn't lose the rest. Each card is attempted
  // independently; failures are collected and reported to the caller.
  const cardDefinitions = [];
  const failures = [];

  for (let i = 0; i < cardList.length; i++) {
    const apiCard = cardList[i];
    try {
      const draft = mapCardToDraft(apiCard);
      const image_url = await uploadCardImageIfAvailable(draft.sourceImageUrl);

      const { cardDef, errors } = createCardDefinition({
        collectionId: collection.id,
        name: draft.name,
        image_url,
        attributes: draft.attributes,
        holoType: draft.holoType,
        rarity: draft.rarity,
        external_card_id: draft.externalCardId,
      });
      if (!cardDef) throw new Error(errors.join(', '));

      cardDefinitions.push(cardDef);
    } catch (err) {
      console.error(`[tcgImport] failed on card "${apiCard.name}" (${apiCard.id}):`, err);
      failures.push({ name: apiCard.name, error: err.message });
    }

    onProgress?.(i + 1, cardList.length);
  }

  return { collection, templateFields, cardDefinitions, failures };
}

/**
 * Creates card definitions for the given (already-filtered-to-new)
 * API cards, to add to an EXISTING collection — the counterpart to
 * buildCollectionFromSet for updating a set that's already been
 * imported, rather than importing one for the first time.
 *
 * Every card is created unowned (no inventory item, no binder
 * placement) — purely adding the card to the collection's roster, the
 * same starting state a freshly-imported card would have. Nothing
 * about the collection's existing cards, ownership, favorites, or
 * binder placements is touched.
 *
 * @param {string} collectionId
 * @param {object[]} apiCards - the NEW cards only (already diffed by the caller)
 * @returns {Promise<{ cardDefinitions: object[], failures: {name: string, error: string}[] }>}
 */
export async function importNewCardsForCollection(collectionId, apiCards) {
  const cardDefinitions = [];
  const failures = [];

  for (const apiCard of apiCards) {
    try {
      const draft = mapCardToDraft(apiCard);
      const image_url = await uploadCardImageIfAvailable(draft.sourceImageUrl);

      const { cardDef, errors } = createCardDefinition({
        collectionId,
        name: draft.name,
        image_url,
        attributes: draft.attributes,
        holoType: draft.holoType,
        rarity: draft.rarity,
        external_card_id: draft.externalCardId,
      });
      if (!cardDef) throw new Error(errors.join(', '));

      cardDefinitions.push(cardDef);
    } catch (err) {
      console.error(`[tcgImport] failed adding new card "${apiCard.name}" (${apiCard.id}):`, err);
      failures.push({ name: apiCard.name, error: err.message });
    }
  }

  return { cardDefinitions, failures };
}

