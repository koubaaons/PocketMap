/**
 * @fileoverview PokemonImportModal — card preview + confirm + progress
 * for importing ONE already-selected Pokémon set.
 * === ISSUE #130 (redesign): full-page set browser ===
 *
 * Extracted out of CollectionModals.jsx's CreateCollectionModal,
 * which used to own the whole search → preview → import flow inline.
 * Set *browsing* now lives in PokemonSetsBrowser.jsx (a full page
 * under Collections, not a modal search step) — this modal only
 * handles what happens after a set is already chosen: preview its
 * cards, confirm, show upload progress, handle partial failures.
 *
 * Takes a `set` (one object from pokemonApi's searchSets/browseSets/
 * fetchAllSets) and calls onSubmit({ collection, templateFields,
 * cardDefinitions }) — the exact same shape useCollectionActions'
 * handleCreate already expects, so no new dispatch logic was needed.
 */

import { useState, useEffect } from 'react';
import { Modal, ModalActions, Button } from '../ui/index.jsx';
import { createCollection, createTemplateField, createCardDefinition } from '../../types/index.js';
import { fetchAllCardsForSet, mapPokemonCardToDraft, POKEMON_TEMPLATE_FIELDS } from '../../services/pokemonApi.js';
import { uploadSharedImageIfMissing } from '../../utils/supabaseImageUpload.js';
import { useAuth } from '../../hooks/useAuth.js';

export function PokemonImportModal({ set, onSubmit, onClose }) {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [importError, setImportError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoadingCards(true);
    setLoadError('');
    fetchAllCardsForSet(set.id)
      .then(result => { if (!cancelled) setCards(result); })
      .catch(err => {
        console.error('[Pokemon import] card fetch failed:', err);
        if (!cancelled) setLoadError('Could not load cards for this set. Check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setIsLoadingCards(false); });
    return () => { cancelled = true; };
  }, [set.id]);

  const handleConfirm = async () => {
    if (!user) return;

    const { collection, errors: cErrors } = createCollection({
      name: set.name,
      is_custom: false,
      import_source: `pokemon-api:${set.id}`,
      cover_image_url: set.images?.logo ?? null,
    });
    if (!collection) { console.error('Collection creation failed:', cErrors); return; }

    const fields = POKEMON_TEMPLATE_FIELDS
      .map((f, idx) => createTemplateField({
        collectionId: collection.id,
        field_name: f.field_name,
        field_type: f.field_type,
        is_required: f.is_required,
        order: idx,
        options: f.options ?? [],
      }).field)
      .filter(Boolean);

    setIsImporting(true);
    setProgress({ done: 0, total: cards.length });

    // Handle partial-failure gracefully — one card's image failing to
    // fetch/upload shouldn't lose the rest. Each card is attempted
    // independently; failures are collected and reported at the end.
    const cardDefs = [];
    const failures = [];

    for (let i = 0; i < cards.length; i++) {
      const apiCard = cards[i];
      try {
        const draft = mapPokemonCardToDraft(apiCard);
        let image_url = null;

        if (draft.sourceImageUrl) {
          // Shared path, not user-scoped — this is official API card
          // art, identical for every user who imports this same
          // card, not a personal photo. One shared copy instead of
          // one-per-user avoids duplicating identical images across
          // every user who imports the same set (see
          // supabaseImageUpload.js's uploadSharedImageIfMissing).
          // The fetch from Pokémon's own CDN is passed in as a lazy
          // function — it only actually runs if this exact card
          // isn't already cached from a previous user's import,
          // instead of always fetching it and then maybe throwing
          // the result away.
          const path = `pokemon-cache/${apiCard.id}.jpg`;
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
        });
        if (!cardDef) throw new Error(errors.join(', '));

        cardDefs.push(cardDef);
      } catch (err) {
        console.error(`[Pokemon import] failed on card "${apiCard.name}" (${apiCard.id}):`, err);
        failures.push({ name: apiCard.name, error: err.message });
      }

      setProgress({ done: i + 1, total: cards.length });
    }

    if (failures.length > 0) {
      setImportError(
        `${failures.length} of ${cards.length} card(s) failed to import and were skipped: ` +
        failures.slice(0, 5).map(f => f.name).join(', ') +
        (failures.length > 5 ? `, and ${failures.length - 5} more` : '') +
        '. The rest imported successfully.'
      );
    }

    onSubmit({ collection, templateFields: fields, cardDefinitions: cardDefs });
  };

  if (isImporting) {
    const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <Modal title="Importing…" onClose={() => {}}>
        <p className="modal-step-intro">
          Uploading images and creating cards — this window will close automatically
          once it's done. Please don't close the app.
        </p>
        <div className="pokemon-import-progress-track">
          <div className="pokemon-import-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="modal-step-note">
          {progress?.done ?? 0} / {progress?.total ?? 0} cards ({pct}%)
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={`Preview: ${set.name}`} onClose={onClose}>
      {isLoadingCards && <p className="modal-step-intro">Loading cards…</p>}
      {loadError && <p className="modal-step-error">{loadError}</p>}
      {!isLoadingCards && !loadError && (
        <>
          <p className="modal-step-intro">
            {cards.length} card(s) will be imported into a new collection.
            Each card's image will be uploaded to your own Storage bucket during import.
          </p>
          {importError && <p className="modal-step-error">{importError}</p>}
          <div className="pokemon-card-preview-grid">
            {cards.slice(0, 24).map(card => (
              <div key={card.id} className="pokemon-card-preview-item">
                {card.images?.small && <img src={card.images.small} alt={card.name} />}
                <span>{card.name}</span>
              </div>
            ))}
          </div>
          {cards.length > 24 && (
            <p className="modal-step-note">…and {cards.length - 24} more.</p>
          )}
        </>
      )}
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={isLoadingCards || !!loadError}>
          Import {cards.length} Card(s)
        </Button>
      </ModalActions>
    </Modal>
  );
}