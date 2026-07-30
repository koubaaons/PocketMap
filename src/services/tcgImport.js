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
import { supabase } from './supabase.js';

/**
 * Caches one card's image via the cache-shared-image Edge Function
 * (shared path, cached across every user -- not per-user), returning
 * the resulting URL. Returns null if sourceImageUrl is null (this
 * card genuinely has no image available from the provider yet).
 *
 * === CHANGED: this used to fetch() the image bytes directly in the
 * browser and re-upload them client-side. That was blocked by CORS --
 * TCGdex's asset CDN sends no CORS headers at all, so every browser,
 * on every origin, refused to let JS read the response -- fixed at
 * the time by just passing the source URL straight through instead.
 * But that broke a DIFFERENT feature: binder export uses html2canvas,
 * which needs to read raw pixel data out of each card image to
 * capture it, and that requires the image to either be same-origin
 * or have real CORS headers set by its own server -- TCGdex's CDN has
 * neither. So a card's image could be *displayed* fine directly from
 * TCGdex, but never *captured* into an export.
 *
 * The actual fix needs the image to end up on OUR OWN domain (so
 * html2canvas can read it) without ever doing the fetch in the
 * browser (so CORS never blocks it in the first place) -- which
 * means doing the fetch server-side. cache-shared-image does exactly
 * that: fetches from TCGdex on the server, where browser CORS simply
 * doesn't apply, and uploads to our own Storage, which already has
 * the right CORS headers for html2canvas to read.
 */
export async function uploadCardImageIfAvailable(sourceImageUrl, cacheKey) {
  if (!sourceImageUrl) return null;

  // Namespaced by PROVIDER_KEY so a future second provider's cache
  // never collides with this one, even if both happened to reuse the
  // same card id.
  const path = `${PROVIDER_KEY}-cache/${cacheKey}.jpg`;
  const { data, error } = await supabase.functions.invoke('cache-shared-image', {
    body: { imageUrl: sourceImageUrl, path },
  });
  if (error || data?.error) {
    throw new Error(data?.error ?? error.message);
  }
  return data.url;
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
      const image_url = await uploadCardImageIfAvailable(draft.sourceImageUrl, apiCard.id);

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
      const image_url = await uploadCardImageIfAvailable(draft.sourceImageUrl, apiCard.id);

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

