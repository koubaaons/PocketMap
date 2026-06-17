/**
 * @fileoverview Binder selectors.
 * Pure functions for deriving binder state from slots.
 */

export function buildPageSlotMap(binderSlots, binderId, pageNumber) {
  const map = {};
  binderSlots
    .filter(s => s.binderId === binderId && s.pageNumber === pageNumber)
    .forEach(s => { map[s.slotIndex] = s; });
  return map;
}

export function getPlacedCardDefIds(binderSlots, binderId) {
  return new Set(
    binderSlots
      .filter(s => s.binderId === binderId)
      .map(s => s.cardDefId)
  );
}

export function getOrganisedCardDefIds(binderSlots) {
  return binderSlots.map(s => s.cardDefId);
}

/**
 * Returns the slot for a card.
 * If binderId is null, searches across ALL binders (used by SearchView).
 * If binderId is provided, searches only that binder.
 */
export function getSlotForCard(binderSlots, binderId, cardDefId) {
  if (binderId === null) {
    // Search across all binders — for SearchView organisation status
    return binderSlots.find(s => s.cardDefId === cardDefId) ?? null;
  }
  return binderSlots.find(s => s.binderId === binderId && s.cardDefId === cardDefId) ?? null;
}

export function isCardInBinder(binderSlots, binderId, cardDefId) {
  return binderSlots.some(s => s.binderId === binderId && s.cardDefId === cardDefId);
}

export function getFilledSlotCount(binderSlots, binderId) {
  return binderSlots.filter(s => s.binderId === binderId).length;
}

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