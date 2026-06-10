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