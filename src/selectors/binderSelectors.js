/**
 * @fileoverview Binder selectors.
 * Pure functions for deriving binder state from slots.
 * No React imports — fully unit-testable.
 */

// === ISSUE #54 START: Add Card to Binder — binder selectors ===

/**
 * Builds a slot map for a specific binder page.
 * Returns Record<slotIndex, slot> for O(1) slot lookups.
 *
 * @param {object[]} binderSlots
 * @param {string} binderId
 * @param {number} pageNumber
 * @returns {Record<number, object>}
 */
export function buildPageSlotMap(binderSlots, binderId, pageNumber) {
  const map = {};
  binderSlots
    .filter(s => s.binderId === binderId && s.pageNumber === pageNumber)
    .forEach(s => { map[s.slotIndex] = s; });
  return map;
}

/**
 * Returns all card def IDs that are placed in a specific binder.
 * Used to prevent placing the same card twice.
 *
 * @param {object[]} binderSlots
 * @param {string} binderId
 * @returns {Set<string>}
 */
export function getPlacedCardDefIds(binderSlots, binderId) {
  return new Set(
    binderSlots
      .filter(s => s.binderId === binderId)
      .map(s => s.cardDefId)
  );
}

/**
 * Returns all card def IDs that are placed in ANY binder.
 * Used by CollectionDetailView to determine organised cards.
 *
 * @param {object[]} binderSlots
 * @returns {string[]}
 */
export function getOrganisedCardDefIds(binderSlots) {
  return binderSlots.map(s => s.cardDefId);
}

/**
 * Returns true if a card is already placed in a specific binder.
 * @param {object[]} binderSlots
 * @param {string} binderId
 * @param {string} cardDefId
 * @returns {boolean}
 */
export function isCardInBinder(binderSlots, binderId, cardDefId) {
  return binderSlots.some(s => s.binderId === binderId && s.cardDefId === cardDefId);
}

/**
 * Returns the slot record for a card in a binder, or null.
 * @param {object[]} binderSlots
 * @param {string} binderId
 * @param {string} cardDefId
 * @returns {object|null}
 */
export function getSlotForCard(binderSlots, binderId, cardDefId) {
  return binderSlots.find(s => s.binderId === binderId && s.cardDefId === cardDefId) ?? null;
}

/**
 * Returns filled slot count for a binder.
 * @param {object[]} binderSlots
 * @param {string} binderId
 * @returns {number}
 */
export function getFilledSlotCount(binderSlots, binderId) {
  return binderSlots.filter(s => s.binderId === binderId).length;
}

// === ISSUE #54 END: Add Card to Binder ===

// === REFACTOR7b START: Move card filter logic to binderSelectors ===

/**
 * Filters card definitions for the AddCardToBinderModal.
 * Excludes cards already placed in the binder.
 * Applies search query across name, collection name, and attributes.
 *
 * @param {object[]} cardDefinitions
 * @param {Set<string>} placedCardIds
 * @param {string} query
 * @param {Record<string, object>} collectionMap
 * @param {number} limit
 * @returns {object[]}
 */
export function filterCardsForBinder(cardDefinitions, placedCardIds, query, collectionMap, limit = 50) {
  const q = query.trim().toLowerCase();
  return cardDefinitions
    .filter(cd => !placedCardIds.has(cd.id))
    .filter(cd => {
      if (!q) return true;
      if (cd.name.toLowerCase().includes(q)) return true;
      const col = collectionMap[cd.collectionId];
      if (col?.name.toLowerCase().includes(q)) return true;
      return Object.values(cd.attributes ?? {}).some(
        v => typeof v === 'string' && v.toLowerCase().includes(q)
      );
    })
    .slice(0, limit);
}

// === REFACTOR7b END ===