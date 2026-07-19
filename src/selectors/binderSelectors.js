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

/**
 * === CHANGED (quantity tracking): this used to return every card
 * placed in just this one binder, and filterCardsForBinder used it to
 * hide those cards from the "add a card" search entirely. That was
 * actually already a latent bug even before quantity tracking was
 * real: it only checked THIS binder, so the same physical card could
 * be "added" to a second, different binder too, even though only one
 * copy exists — physically impossible. Now returns only cards where
 * EVERY owned copy is already placed somewhere (any binder, any
 * card-type panel) — the actual real-world limit, not a per-binder
 * approximation of it.
 */
/**
 * @param {object[]} allBinderSlots
 * @param {object[]} allBinderPanels
 * @param {object[]} inventory
 * @param {string} [currentBinderId] - needed to also exclude an
 *   UNOWNED card already placed as a grey placeholder in THIS
 *   specific binder. Owned cards are limited globally by quantity
 *   (handled below regardless of binder), but unowned cards have no
 *   quantity concept — they're limited per-binder instead (can't
 *   place the same unowned card twice in the same binder, but CAN in
 *   a different one — see reducer.js's BINDER_SLOT_ADD). Without this
 *   param, an unowned card already placed in the current binder would
 *   still show as "available to add" in search, only to be silently
 *   rejected by the reducer if actually selected.
 */
export function getFullyPlacedCardDefIds(allBinderSlots, allBinderPanels, inventory, currentBinderId = null) {
  const quantityByCard = {};
  inventory.forEach(inv => { quantityByCard[inv.cardDefId] = (quantityByCard[inv.cardDefId] ?? 0) + 1; });

  const placedByCard = {};
  allBinderSlots.forEach(s => { placedByCard[s.cardDefId] = (placedByCard[s.cardDefId] ?? 0) + 1; });
  allBinderPanels
    .filter(p => p.panelType === 'card')
    .forEach(p => { placedByCard[p.cardDefId] = (placedByCard[p.cardDefId] ?? 0) + 1; });

  const fullyPlaced = new Set();
  Object.entries(quantityByCard).forEach(([cardDefId, qty]) => {
    if ((placedByCard[cardDefId] ?? 0) >= qty) fullyPlaced.add(cardDefId);
  });

  // Unowned cards (quantity 0) never appear in quantityByCard above at
  // all, so the loop never considers them — handled separately here.
  if (currentBinderId) {
    const unownedCardIdsInThisBinder = new Set([
      ...allBinderSlots
        .filter(s => s.binderId === currentBinderId && !quantityByCard[s.cardDefId])
        .map(s => s.cardDefId),
      ...allBinderPanels
        .filter(p => p.binderId === currentBinderId && p.panelType === 'card' && !quantityByCard[p.cardDefId])
        .map(p => p.cardDefId),
    ]);
    unownedCardIdsInThisBinder.forEach(cardDefId => fullyPlaced.add(cardDefId));
  }

  return fullyPlaced;
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

/**
 * Same as getSlotForCard, but returns EVERY matching slot across all
 * binders, not just the first one found — needed for cards with
 * multiple copies (quantity tracking), where each copy could be
 * placed in a different slot/binder and all of them should be
 * shown, not just one.
 */
export function getAllSlotsForCard(binderSlots, cardDefId) {
  return binderSlots.filter(s => s.cardDefId === cardDefId);
}

export function isCardInBinder(binderSlots, binderId, cardDefId) {
  return binderSlots.some(s => s.binderId === binderId && s.cardDefId === cardDefId);
}

export function getFilledSlotCount(binderSlots, binderId) {
  return binderSlots.filter(s => s.binderId === binderId).length;
}

/**
 * Whether a specific slot position in a binder is currently free —
 * used when restoring a removed copy's old placement, to check
 * whether something else has since been placed there (see
 * reducer.js's BIN_RESTORE_INVENTORY_ITEM case and useBinActions.js,
 * which both need this exact same check to agree with each other).
 */
export function isSlotPositionFree(binderSlots, binderId, pageNumber, slotIndex) {
  return !binderSlots.some(
    s => s.binderId === binderId && s.pageNumber === pageNumber && s.slotIndex === slotIndex
  );
}

/**
 * How many copies of a specific card are currently placed anywhere —
 * across every binder, not just one — counting both normal slots and
 * card-type combined-slot panels (Michi Method; insert-type panels
 * aren't a real card and never count). Used to enforce quantity
 * limits: a card can't be placed in more slots than copies actually
 * owned, since each physical copy can only be in one place at once.
 */
export function getTotalPlacedCount(binderSlots, binderPanels, cardDefId) {
  const slotCount  = binderSlots.filter(s => s.cardDefId === cardDefId).length;
  const panelCount = binderPanels.filter(p => p.panelType === 'card' && p.cardDefId === cardDefId).length;
  return slotCount + panelCount;
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