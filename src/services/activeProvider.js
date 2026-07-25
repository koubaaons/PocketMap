/**
 * @fileoverview activeProvider — the one file every UI component
 * imports for set/card data, instead of importing a specific
 * provider (like pokemonProvider.js or tcgdexProvider.js) directly.
 *
 * === CHANGED: swapped from pokemonProvider.js (backed by
 * pokemontcg.io) to tcgdexProvider.js (backed by TCGdex) ===
 * pokemontcg.io has been acquired and folded into "Scrydex", a paid
 * multi-TCG platform — multiple sources describe its free tier as
 * being actively wound down in favor of the paid successor. Since
 * this app hadn't been deployed yet, this was the right moment to
 * switch rather than build further on a provider likely to need
 * replacing anyway. This is the entire swap — exactly one line below
 * changed, nothing else in the app needed to.
 */

export * from './providers/tcgdexProvider.js';
