/**
 * @fileoverview Pokémon TCG provider — the adapter between the raw
 * Pokémon TCG API client (pokemonApi.js) and the rest of the app.
 *
 * === Why this file exists ===
 * Before this, PokemonSetsBrowser.jsx and PokemonImportModal.jsx both
 * imported pokemonApi.js directly — fine while Pokémon was the only
 * TCG this app supported, but it meant "the app only knows Pokémon"
 * was baked into two different UI components, not confined to one
 * place. Requested directly: make it so a future API swap (or adding
 * a second TCG later — One Piece and Yu-Gi-Oh are both on the
 * roadmap, deliberately deferred until Pokémon is proven out) doesn't
 * mean touching UI code at all.
 *
 * Every provider — this one, and any added later — implements the
 * same five-piece interface:
 *   - fetchAllSets()                      → Set[]
 *   - fetchCardsForSet(setId, page, size) → { cards, page, pageSize, totalCount }
 *   - fetchAllCardsForSet(setId, onProgress) → Card[]
 *   - mapCardToDraft(card)                → the shape createCardDefinition expects
 *   - TEMPLATE_FIELDS                     → this game's default custom-field schema
 *
 * UI components never import this file directly either — they import
 * ../activeProvider.js, which just re-exports whichever provider is
 * currently active. Swapping providers, or supporting a second one
 * later, means changing that one file, not any component.
 *
 * Pokémon TCG API's own responses already happen to be close to this
 * shape (id/name/series/images/releaseDate for sets), so this adapter
 * is mostly a thin pass-through plus the rename from Pokémon-specific
 * function names to the generic interface names — the "genericizing"
 * work is really about the STABLE NAMES/CONTRACT this file guarantees,
 * not a heavy data transformation.
 */

import {
  fetchAllSets as pokemonFetchAllSets,
  fetchCardsForSet as pokemonFetchCardsForSet,
  fetchAllCardsForSet as pokemonFetchAllCardsForSet,
  mapPokemonCardToDraft,
  POKEMON_TEMPLATE_FIELDS,
} from '../pokemonApi.js';

export const TEMPLATE_FIELDS = POKEMON_TEMPLATE_FIELDS;

export const fetchAllSets = pokemonFetchAllSets;
export const fetchCardsForSet = pokemonFetchCardsForSet;
export const fetchAllCardsForSet = pokemonFetchAllCardsForSet;
export const mapCardToDraft = mapPokemonCardToDraft;

// Every set this provider returns is Pokémon-sourced — used by the
// Seed Loader (#135) and nightly set-check (#134) to label a
// collection/set with which game it came from, without either of
// those features needing to know "Pokémon" specifically themselves.
export const GAME_LABEL = 'Pokémon TCG';

// A short, storage-path-safe identifier (used for shared image cache
// paths and the collection's import_source field) — kept separate
// from GAME_LABEL since that one has a space and an accent, neither
// of which belong in a URL/file path.
export const PROVIDER_KEY = 'pokemon';
