/**
 * @fileoverview Inventory selectors.
 *
 * Pure functions for deriving ownership state from inventory records.
 * No React imports — fully unit-testable.
 *
 * Core truth:
 *   Owned    = USER_INVENTORY record exists for this cardDefId
 *   Not owned = no record
 */

// === ISSUE #36 START: Mark Card As Owned — ownership selectors ===

/**
 * Returns true if the user owns this card.
 * @param {object[]} inventory
 * @param {string} cardDefId
 * @returns {boolean}
 */
export function isOwned(inventory, cardDefId) {
  return inventory.some(inv => inv.cardDefId === cardDefId);
}

/**
 * Returns the inventory item for a card, or null if not owned.
 * @param {object[]} inventory
 * @param {string} cardDefId
 * @returns {object|null}
 */
export function getInventoryItem(inventory, cardDefId) {
  return inventory.find(inv => inv.cardDefId === cardDefId) ?? null;
}

/**
 * Builds an ownership map for fast O(1) lookups.
 * Use this when rendering a list of cards to avoid O(n²).
 *
 * @param {object[]} inventory
 * @returns {Record<string, object>} cardDefId → inventoryItem
 */
export function buildOwnershipMap(inventory) {
  const map = {};
  inventory.forEach(inv => { map[inv.cardDefId] = inv; });
  return map;
}

// === ISSUE #36 END: Mark Card As Owned ===


// === ISSUE #38 START: Favorite Cards — favorite selectors ===

/**
 * Returns all inventory items marked as favorite,
 * with their full card definition attached.
 *
 * @param {object[]} inventory
 * @param {object[]} cardDefinitions
 * @returns {Array<{ inventoryItem: object, cardDef: object }>}
 */
export function getFavoriteCards(inventory, cardDefinitions) {
  const cardDefMap = {};
  cardDefinitions.forEach(cd => { cardDefMap[cd.id] = cd; });

  return inventory
    .filter(inv => inv.is_favorite)
    .map(inv => ({
      inventoryItem: inv,
      cardDef: cardDefMap[inv.cardDefId] ?? null,
    }))
    .filter(({ cardDef }) => cardDef !== null); // drop orphans
}

/**
 * Returns true if the user has favorited this card.
 * @param {object[]} inventory
 * @param {string} cardDefId
 * @returns {boolean}
 */
export function isFavorite(inventory, cardDefId) {
  const item = getInventoryItem(inventory, cardDefId);
  return item?.is_favorite ?? false;
}

// === ISSUE #38 END: Favorite Cards ===