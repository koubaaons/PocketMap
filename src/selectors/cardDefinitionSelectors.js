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

export function applyCardDefinitionFilters(cards, query, sortBy, filters = {}) {
  return sortCardDefinitions(filterCardDefinitions(applyEntityFilters(cards, filters), query), sortBy);
}

// === New: filter by rarity, holo effect, or any select/boolean custom
// template field — "filter collections based on entities like rarity
// etc", requested directly. filters is a plain { key: value } map;
// a key is only applied if its value is truthy (an unset/"Any" filter
// is simply absent, not an empty-string match).
export function applyEntityFilters(cards, filters = {}) {
  const activeEntries = Object.entries(filters).filter(([, v]) => v !== '' && v != null);
  if (activeEntries.length === 0) return cards;

  return cards.filter(card => activeEntries.every(([key, value]) => {
    if (key === 'rarity')   return (card.rarity ?? '') === value;
    if (key === 'holoType') return (card.holoType ?? 'none') === value;

    // Custom template field, read off card.attributes. Boolean fields
    // store real booleans, but the filter UI offers 'Yes'/'No' as
    // plain strings (see getFilterGroupsForCollection) — no live
    // select control cleanly represents "true/false/unset" with a
    // literal boolean value, so the comparison translates here
    // instead of forcing the UI to juggle non-string option values.
    const actual = card.attributes?.[key];
    if (value === 'Yes') return actual === true;
    if (value === 'No')  return actual !== true;
    return actual === value;
  }));
}

/**
 * Which filters are actually worth showing for this set of cards —
 * rarity/holo groups only appear if more than one distinct value is
 * actually in use (filtering by a value every card already has isn't
 * useful), and custom fields only appear for select/boolean types
 * (text/number fields don't have a fixed, filterable value set).
 * @param {object[]} cards
 * @param {object[]} templateFields - already scoped to one collection
 */
export function getFilterGroupsForCollection(cards, templateFields) {
  const groups = [];

  const rarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))].sort();
  if (rarities.length > 1) {
    groups.push({ key: 'rarity', label: 'Rarity', options: rarities.map(r => ({ value: r, label: r })) });
  }

  const holoTypesInUse = [...new Set(cards.map(c => c.holoType ?? 'none'))];
  if (holoTypesInUse.length > 1) {
    groups.push({
      key: 'holoType',
      label: 'Holo Effect',
      options: holoTypesInUse.map(t => ({ value: t, label: t })), // caller maps to HOLO_LABELS for display
    });
  }

  templateFields.forEach(field => {
    if (field.field_type === 'select' && (field.options ?? []).length > 0) {
      groups.push({
        key: field.field_name,
        label: field.field_name,
        options: field.options.map(o => ({ value: o, label: o })),
      });
    } else if (field.field_type === 'boolean') {
      groups.push({
        key: field.field_name,
        label: field.field_name,
        options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }],
      });
    }
  });

  return groups;
}

// === ISSUE #15 END: Card Definitions List — search and sort selectors ===
export function getCardDefinitionsForCollection(cardDefinitions, collectionId) {
  return cardDefinitions.filter(cd => cd.collectionId === collectionId);
}