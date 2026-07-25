/**
 * @fileoverview TCGdex provider — the adapter between the raw TCGdex
 * API client (tcgdexApi.js) and the rest of the app.
 *
 * Implements the exact same five-piece interface pokemonProvider.js
 * did — this is the whole point of the provider abstraction: swapping
 * from pokemontcg.io to TCGdex means adding this one file and
 * flipping activeProvider.js to point at it, without touching
 * PokemonSetsBrowser.jsx, PokemonImportModal.jsx, the Seed Loader, or
 * the collection-update-check feature at all.
 */

import {
  fetchAllSets as tcgdexFetchAllSets,
  fetchCardsForSet as tcgdexFetchCardsForSet,
  fetchAllCardsForSet as tcgdexFetchAllCardsForSet,
  mapTcgdexCardToDraft,
  TCGDEX_TEMPLATE_FIELDS,
} from '../tcgdexApi.js';

export const TEMPLATE_FIELDS = TCGDEX_TEMPLATE_FIELDS;

export const fetchAllSets = tcgdexFetchAllSets;
export const fetchCardsForSet = tcgdexFetchCardsForSet;
export const fetchAllCardsForSet = tcgdexFetchAllCardsForSet;
export const mapCardToDraft = mapTcgdexCardToDraft;

// TCGdex is a different DATA SOURCE for Pokémon, not a different
// game — GAME_LABEL stays "Pokémon TCG" so collections' import_source
// still reads naturally ("Pokémon TCG: Base Set"), regardless of
// which underlying provider actually supplied the data.
export const GAME_LABEL = 'Pokémon TCG';

// Distinct from the previous provider's key ('pokemon') on purpose —
// this is what lets useCollectionUpdateCheck.js correctly tell
// "a collection imported via the old pokemontcg.io-backed provider"
// apart from "a collection imported via this one", even though both
// happen to cover the same game.
export const PROVIDER_KEY = 'tcgdex';
