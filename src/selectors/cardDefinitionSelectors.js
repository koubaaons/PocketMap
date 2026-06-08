/**
 * @fileoverview Card definition selectors.
 *
 * Pure functions for filtering and sorting card definitions.
 * No React imports — fully unit-testable.
 *
 * Keeping search/sort logic here means CardDefinitionList stays
 * collection-agnostic and receives a pre-filtered slice.
 */

// === ISSUE #15 START: Card Definitions List — search and sort selectors ===

/**
 * Filters card definitions by search query.
 * Searches card name and all string attribute values.
 *
 * @param {object[]} cards
 * @param {string} query
 * @returns {object[]}
 */
export function filterCardDefinitions(cards, query) {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(card => {
    if (card.name.toLowerCase().includes(q)) return true;
    // Also search inside attributes
    return Object.values(card.attributes ?? {}).some(
      val => typeof val === 'string' && val.toLowerCase().includes(q)
    );
  });
}

/**
 * Sorts card definitions.
 * @param {object[]} cards
 * @param {'name_asc'|'name_desc'|'newest'|'oldest'} sortBy
 * @returns {object[]}
 */
export function sortCardDefinitions(cards, sortBy) {
  const copy = [...cards];
  switch (sortBy) {
    case 'name_asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'oldest':
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'newest':
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

/**
 * Applies both filter and sort in the correct order.
 * Filter first (smaller set), then sort.
 *
 * @param {object[]} cards
 * @param {string} query
 * @param {'name_asc'|'name_desc'|'newest'|'oldest'} sortBy
 * @returns {object[]}
 */
export function applyCardDefinitionFilters(cards, query, sortBy) {
  return sortCardDefinitions(filterCardDefinitions(cards, query), sortBy);
}

// === ISSUE #15 END: Card Definitions List — search and sort selectors ===