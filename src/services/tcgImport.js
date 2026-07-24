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
import { uploadSharedImageIfMissing } from '../utils/supabaseImageUpload.js';
import { fetchAllCardsForSet, mapCardToDraft, TEMPLATE_FIELDS, GAME_LABEL, PROVIDER_KEY } from './activeProvider.js';

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
      let image_url = null;

      if (draft.sourceImageUrl) {
        // Shared path, not user-scoped — official card art is
        // identical for every user who imports this same card, not a
        // personal photo. One shared copy instead of one-per-user
        // avoids duplicating identical images across every user who
        // imports the same set (see supabaseImageUpload.js's
        // uploadSharedImageIfMissing). Namespaced by PROVIDER_KEY so
        // a future second provider's cache never collides with this
        // one, even if both happened to reuse the same card id.
        const path = `${PROVIDER_KEY}-cache/${apiCard.id}.jpg`;
        image_url = await uploadSharedImageIfMissing(async () => {
          const imgRes = await fetch(draft.sourceImageUrl);
          if (!imgRes.ok) throw new Error(`image fetch failed (${imgRes.status})`);
          return imgRes.blob();
        }, path);
      }

      const { cardDef, errors } = createCardDefinition({
        collectionId: collection.id,
        name: draft.name,
        image_url,
        attributes: draft.attributes,
        holoType: draft.holoType,
        rarity: draft.rarity,
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
