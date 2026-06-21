/**
 * @fileoverview Inventory selectors.
 *
 * Pure functions for deriving ownership state from inventory records.
 * No React imports — fully unit-testable.
 *
 * Core truth:
 *   Owned     = USER_INVENTORY record exists for this cardDefId
 *   Not owned = no record
 */

// === ISSUE #36 START: Mark Card As Owned — ownership selectors ===

export function isOwned(inventory, cardDefId) {
  return inventory.some(inv => inv.cardDefId === cardDefId);
}

export function getInventoryItem(inventory, cardDefId) {
  return inventory.find(inv => inv.cardDefId === cardDefId) ?? null;
}

export function buildOwnershipMap(inventory) {
  const map = {};
  inventory.forEach(inv => { map[inv.cardDefId] = inv; });
  return map;
}

// === ISSUE #36 END: Mark Card As Owned ===

// === ISSUE #38 START: Favorite Cards — favorite selectors ===

export function getFavoriteCards(inventory, cardDefinitions) {
  const cardDefMap = {};
  cardDefinitions.forEach(cd => { cardDefMap[cd.id] = cd; });
  return inventory
    .filter(inv => inv.is_favorite)
    .map(inv => ({ inventoryItem: inv, cardDef: cardDefMap[inv.cardDefId] ?? null }))
    .filter(({ cardDef }) => cardDef !== null);
}

export function isFavorite(inventory, cardDefId) {
  const item = getInventoryItem(inventory, cardDefId);
  return item?.is_favorite ?? false;
}

// === ISSUE #38 END: Favorite Cards ===

// === ISSUE #85 START: Favorites View Polish — sort favorites ===

/**
 * Available sort options for the Favorites view.
 * 'recent' — most recently OWNED first (acquired_at ?? createdAt), not
 *            most recently favorited — favoriting touches updatedAt,
 *            which is a shared field also touched by other edits, so
 *            it's not a reliable "favorited at" signal. Acquisition
 *            date is unambiguous.
 * 'name'   — card name, A → Z
 *
 * No 'collection' sort option — see getFavoriteCollections/the
 * collection FILTER dropdown in FavoritesView instead. Sorting
 * alphabetically by collection name was removed: once you can filter
 * down to one collection, sorting "by collection" within an
 * already-single-collection list is meaningless — it'd just fall back
 * to sorting by name anyway.
 */
export const FAVORITES_SORT_OPTIONS = Object.freeze([
  { value: 'recent', label: 'Recently Added' },
  { value: 'name',   label: 'Name' },
]);

/**
 * Sorts favorite card entries (as returned by getFavoriteCards) by the
 * given sort key.
 *
 * @param {{ inventoryItem: object, cardDef: object }[]} favorites
 * @param {string} sortBy - one of FAVORITES_SORT_OPTIONS values
 * @returns {{ inventoryItem: object, cardDef: object }[]}
 */
export function sortFavoriteCards(favorites, sortBy) {
  const copy = [...favorites];

  switch (sortBy) {
    case 'name':
      return copy.sort((a, b) => a.cardDef.name.localeCompare(b.cardDef.name));

    case 'recent':
    default:
      return copy.sort((a, b) => {
        const aTime = a.inventoryItem.acquired_at ?? a.inventoryItem.createdAt;
        const bTime = b.inventoryItem.acquired_at ?? b.inventoryItem.createdAt;
        return bTime - aTime;
      });
  }
}

/**
 * Returns the distinct collections that have at least one favorited
 * card, sorted alphabetically — used to populate the collection FILTER
 * dropdown (not a sort). Each entry includes a count so the dropdown can
 * show "Yu-Gi-Oh (4)" style labels if desired.
 *
 * @param {{ inventoryItem: object, cardDef: object }[]} favorites
 * @param {Record<string, object>} collectionMap
 * @returns {{ id: string, name: string, count: number }[]}
 */
export function getFavoriteCollectionOptions(favorites, collectionMap) {
  const counts = {};
  favorites.forEach(({ cardDef }) => {
    const col = collectionMap[cardDef.collectionId];
    if (!col) return;
    counts[col.id] = (counts[col.id] ?? 0) + 1;
  });

  return Object.entries(counts)
    .map(([id, count]) => ({ id, name: collectionMap[id]?.name ?? 'Unknown', count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// === ISSUE #85 END ===

// === ISSUE #45 START: Collection Tabs — Owned & Missing — tab selectors ===

/**
 * Returns cards that the user owns (inventory record exists).
 * @param {object[]} cards - collection's card definitions
 * @param {Record<string, object>} ownershipMap - built via buildOwnershipMap
 * @returns {object[]}
 */
export function getOwnedCards(cards, ownershipMap) {
  return cards.filter(card => ownershipMap[card.id] !== undefined);
}

/**
 * Returns cards the user does not own (no inventory record).
 * @param {object[]} cards
 * @param {Record<string, object>} ownershipMap
 * @returns {object[]}
 */
export function getMissingCards(cards, ownershipMap) {
  return cards.filter(card => ownershipMap[card.id] === undefined);
}

// === ISSUE #45 END: Collection Tabs — Owned & Missing ===

// === ISSUE #46 START: Collection Tab — Unorganised ===

/**
 * Returns owned cards that are not yet placed in a binder slot.
 * Until Milestone 7 (binder slots), all owned cards are considered unorganised.
 * After Milestone 7, filter by: owned AND no BINDER_SLOT record.
 *
 * @param {object[]} cards
 * @param {Record<string, object>} ownershipMap
 * @param {string[]} organisedCardDefIds - card def IDs that have binder slots (empty until M7)
 * @returns {object[]}
 */
export function getUnorganisedCards(cards, ownershipMap, organisedCardDefIds = []) {
  const organisedSet = new Set(organisedCardDefIds);
  return cards.filter(card =>
    ownershipMap[card.id] !== undefined && !organisedSet.has(card.id)
  );
}

// === ISSUE #46 END: Collection Tab — Unorganised ===

// === ISSUE #47 START: Collection Summary — stats selector ===

/**
 * Builds a stats summary for a single collection.
 * Single O(n) pass — call once per render, not per card.
 *
 * @param {object[]} cards - collection's card definitions
 * @param {Record<string, object>} ownershipMap
 * @param {string[]} organisedCardDefIds - empty until Milestone 7
 * @returns {{
 *   total: number,
 *   owned: number,
 *   missing: number,
 *   unorganised: number,
 *   pct: number,
 * }}
 */
export function buildCollectionSummary(cards, ownershipMap, organisedCardDefIds = []) {
  const organisedSet = new Set(organisedCardDefIds);
  let owned = 0;
  let unorganised = 0;

  cards.forEach(card => {
    if (ownershipMap[card.id]) {
      owned++;
      if (!organisedSet.has(card.id)) unorganised++;
    }
  });

  const total   = cards.length;
  const missing = total - owned;
  const pct     = total > 0 ? Math.round((owned / total) * 100) : 0;

  return { total, owned, missing, unorganised, pct };
}

// === ISSUE #47 END: Collection Summary ===