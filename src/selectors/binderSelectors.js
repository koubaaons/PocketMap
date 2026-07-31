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
 * === CHANGED: a card, owned or not, can now only ever be placed in
 * ONE binder at a time — requested directly. Previously, owning
 * multiple copies let the same card sit in several different binders
 * simultaneously (up to quantityOwned placements, counted globally);
 * now the first placement anywhere blocks any other, regardless of
 * how many physical copies exist. This made the whole function much
 * simpler: "already placed anywhere" no longer needs to compare
 * against owned quantity, or treat owned/unowned cards differently,
 * or take a currentBinderId at all.
 */
/**
 * @param {object[]} allBinderSlots
 * @param {object[]} allBinderPanels
 */
export function getFullyPlacedCardDefIds(allBinderSlots, allBinderPanels, inventory) {
  const placedInventoryIds = new Set([
    ...allBinderSlots.filter(s => s.inventoryItemId).map(s => s.inventoryItemId),
    ...allBinderPanels.filter(p => p.panelType === 'card' && p.inventoryItemId).map(p => p.inventoryItemId),
  ]);
  const cardDefIdsWithMissingPlaceholder = new Set([
    ...allBinderSlots.filter(s => !s.inventoryItemId).map(s => s.cardDefId),
    ...allBinderPanels.filter(p => p.panelType === 'card' && !p.inventoryItemId).map(p => p.cardDefId),
  ]);

  const ownedCopyIdsByCard = new Map();
  inventory.forEach(inv => {
    if (!ownedCopyIdsByCard.has(inv.cardDefId)) ownedCopyIdsByCard.set(inv.cardDefId, []);
    ownedCopyIdsByCard.get(inv.cardDefId).push(inv.id);
  });

  const fullyPlaced = new Set();
  // Owned cards: fully placed once every owned copy already has a
  // slot/panel of its own — mirrors exactly what the reducer would
  // do (auto-pick the first unplaced copy; nothing left to pick once
  // all are placed).
  for (const [cardDefId, copyIds] of ownedCopyIdsByCard) {
    if (copyIds.every(id => placedInventoryIds.has(id))) fullyPlaced.add(cardDefId);
  }
  // Unowned cards: fully placed once a missing placeholder already
  // exists for them — only one is ever allowed, since it has no copy
  // identity to distinguish a second one from.
  for (const cardDefId of cardDefIdsWithMissingPlaceholder) {
    if (!ownedCopyIdsByCard.has(cardDefId)) fullyPlaced.add(cardDefId);
  }
  return fullyPlaced;
}

export function getOrganisedCardDefIds(binderSlots, binderPanels = []) {
  return [
    ...binderSlots.map(s => s.cardDefId),
    ...binderPanels.filter(p => p.panelType === 'card').map(p => p.cardDefId),
  ];
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

/**
 * Builds the list of "spreads" for a binder — pairs of facing pages,
 * exactly like opening a real physical binder: spread 1 is the inside
 * of the front cover (blank — leftPageNum null) alongside page 1;
 * spread 2 is pages 2 and 3; spread 3 is pages 4 and 5; and so on.
 *
 * Deliberately the exact same pairing formula as BinderBookFlip.jsx's
 * own pagePairs/isFlipped logic (frontPageNum = 2n-1, backPageNum =
 * 2n) — this represents the same physical binder two different ways
 * (an interactive flip-through view vs. a static export), so the two
 * must never drift apart from each other. Re-derived here rather than
 * imported directly since that component's version is entangled with
 * its own flip-animation state (spread position, transition tracking)
 * that has no meaning for a one-shot export.
 *
 * An even page count leaves the very last page with no partner (a
 * real physical binder has the same issue — the last sheet only has
 * one side with a printed page on it) — that spread's rightPageNum is
 * null instead.
 *
 * @param {number} totalPages
 * @returns {{ spreadIndex: number, leftPageNum: number|null, rightPageNum: number|null }[]}
 */
export function buildSpreadList(totalPages) {
  const spreads = [];
  for (let n = 1; (2 * n - 2) <= totalPages; n++) {
    const leftPageNum  = n === 1 ? null : (2 * n - 2);
    const rightPageNum = (2 * n - 1) <= totalPages ? (2 * n - 1) : null;
    spreads.push({ spreadIndex: n, leftPageNum, rightPageNum });
  }
  return spreads;
}