/**
 * @fileoverview activeProvider — the one file every UI component
 * imports for set/card data, instead of importing a specific
 * provider (like pokemonProvider.js) directly.
 *
 * Right now there's exactly one provider, so this just re-exports it.
 * The point isn't complexity today — it's that swapping Pokémon TCG
 * API for a different one later, or adding a second game (One Piece
 * and Yu-Gi-Oh are both deferred, not cancelled — see the Seed Loader
 * and TabToolbar's roadmap notes), means changing the line below, or
 * adding a small "pick a provider for this collection" branch here —
 * never touching PokemonSetsBrowser.jsx, PokemonImportModal.jsx, or
 * anything else that currently only knows about Pokémon.
 */

export * from './providers/pokemonProvider.js';
