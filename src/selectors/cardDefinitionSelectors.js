/**
 * @fileoverview Card definition selectors.
 * Pure functions for filtering and sorting card definitions.
 * No React imports — fully unit-testable.
 */

// === ISSUE #15 START: Card Definitions List — search and sort selectors ===

// === REFACTOR5e START: Move SORT_OPTIONS to selectors ===
/**
 * Available sort options for card definition lists.
 * Single source of truth — import anywhere a sort control is needed.
 */
export const CARD_SORT_OPTIONS = Object.freeze([
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
  { value: 'name_asc',  label: 'Name A → Z'   },
  { value: 'name_desc', label: 'Name Z → A'   },
]);
// === REFACTOR5e END ===

export function filterCardDefinitions(cards, query) {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter(card => {
    if (card.name.toLowerCase().includes(q)) return true;
    return Object.values(card.attributes ?? {}).some(
      val => typeof val === 'string' && val.toLowerCase().includes(q)
    );
  });
}

export function sortCardDefinitions(cards, sortBy) {
  const copy = [...cards];
  switch (sortBy) {
    case 'name_asc':  return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc': return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'oldest':    return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'newest':
    default:          return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export function applyCardDefinitionFilters(cards, query, sortBy) {
  return sortCardDefinitions(filterCardDefinitions(cards, query), sortBy);
}

// === ISSUE #15 END: Card Definitions List — search and sort selectors ===