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

/**
 * Same as getFilledSlotCount, but only counts slots whose card is
 * actually OWNED — getFilledSlotCount counts every slot with a card
 * placed regardless of ownership, including greyed-out "not owned"
 * placeholders, which made progress percentages count cards that
 * hadn't actually been acquired yet.
 *
 * Also counts card-type combined-slot panels (Michi Method) whose
 * card is owned — a panel holding a real card is still a real, owned
 * card taking up a spot, same as a normal slot. Insert-type panels
 * (decorative art, not a card at all) never count here.
 */
export function getOwnedFilledSlotCount(binderSlots, binderId, inventory, binderPanels = []) {
  const ownedCardDefIds = new Set(inventory.map(inv => inv.cardDefId));
  const normalSlotCount = binderSlots.filter(
    s => s.binderId === binderId && ownedCardDefIds.has(s.cardDefId)
  ).length;
  const panelCardCount = binderPanels.filter(
    p => p.binderId === binderId && p.panelType === 'card' && ownedCardDefIds.has(p.cardDefId)
  ).length;
  return normalSlotCount + panelCardCount;
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
export function getSlotById(binderSlots, slotId) {
  return binderSlots.find(s => s.id === slotId) ?? null;
}