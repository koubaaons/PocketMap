/**
 * @fileoverview Home dashboard selectors.
 *
 * === ISSUE #83: Home Dashboard ===
 *
 * Recent Activity is DERIVED, not a real event log. There's no dedicated
 * activity-log store slice — building one would mean touching the reducer
 * for nearly every action type just to also push a log entry, which is a
 * wide change for a dashboard widget and risks getting inconsistent
 * (forget one action type, log duplicates, etc).
 *
 * Instead we reconstruct a reasonable feed from timestamps that already
 * exist on real records:
 *   - "Added to collection"  → inventory.acquired_at ?? inventory.createdAt
 *   - "Favorited"            → inventory.updatedAt, only when is_favorite
 *                               is currently true (best-effort signal —
 *                               updatedAt also changes on other inventory
 *                               edits like condition rating, so this can
 *                               occasionally mislabel a non-favorite edit
 *                               as a "favorited" event if it happened to
 *                               touch a record that's also favorited)
 *   - "Created collection"   → collection.createdAt
 *   - "Added to binder"      → binderSlot.createdAt
 *
 * No "moved" or "traded"/"sold" events — slot MOVES don't update
 * createdAt (only the initial placement does), and there's no
 * trade/sell timestamp anywhere in the data model. If richer history
 * (undo, full audit trail) becomes a real need later, that's the point
 * to build an actual activity-log store slice instead of extending this
 * further.
 */

/**
 * Builds the 5 home dashboard stat values in a single pass.
 *
 * @param {object[]} binders
 * @param {object[]} cardDefinitions
 * @param {object[]} inventory
 * @param {object[]} binderSlots
 * @returns {{ totalCards: number, totalBinders: number, favorites: number, unorganised: number, recentlyAdded: number }}
 */
export function buildHomeStats(binders, cardDefinitions, inventory, binderSlots) {
  const totalCards   = cardDefinitions.length;
  const totalBinders = binders.length;
  const favorites    = inventory.filter(inv => inv.is_favorite).length;

  // Unorganised = owned but not placed in any binder slot
  const organisedCardDefIds = new Set(binderSlots.map(s => s.cardDefId));
  const unorganised = inventory.filter(inv => !organisedCardDefIds.has(inv.cardDefId)).length;

  // Recently added = owned within the last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentlyAdded = inventory.filter(inv => (inv.acquired_at ?? inv.createdAt) >= sevenDaysAgo).length;

  return { totalCards, totalBinders, favorites, unorganised, recentlyAdded };
}

/**
 * Returns the most recently owned cards, newest first, with their card
 * definition attached for display (image, name).
 *
 * @param {object[]} inventory
 * @param {object[]} cardDefinitions
 * @param {number} [limit=5]
 * @returns {{ inventoryItem: object, cardDef: object }[]}
 */
export function getRecentlyAddedCards(inventory, cardDefinitions, limit = 5) {
  const cardDefMap = {};
  cardDefinitions.forEach(cd => { cardDefMap[cd.id] = cd; });

  return inventory
    .map(inv => ({ inventoryItem: inv, cardDef: cardDefMap[inv.cardDefId] ?? null }))
    .filter(({ cardDef }) => cardDef !== null)
    .sort((a, b) => (b.inventoryItem.acquired_at ?? b.inventoryItem.createdAt) - (a.inventoryItem.acquired_at ?? a.inventoryItem.createdAt))
    .slice(0, limit);
}

/**
 * Builds a derived activity feed from existing timestamps. See file-level
 * comment for what this can and can't represent.
 *
 * @param {object[]} inventory
 * @param {object[]} cardDefinitions
 * @param {object[]} collections
 * @param {object[]} [binderSlots=[]]
 * @param {object[]} [binders=[]]
 * @param {number} [limit=8]
 * @returns {{ id: string, type: 'added'|'favorited'|'collection_created'|'added_to_binder', label: string, timestamp: number }[]}
 */
export function getRecentActivity(inventory, cardDefinitions, collections, binderSlots = [], binders = [], limit = 8) {
  const cardDefMap = {};
  cardDefinitions.forEach(cd => { cardDefMap[cd.id] = cd; });

  const binderMap = {};
  binders.forEach(b => { binderMap[b.id] = b; });

  const events = [];

  inventory.forEach(inv => {
    const cardDef = cardDefMap[inv.cardDefId];
    if (!cardDef) return;

    const addedAt = inv.acquired_at ?? inv.createdAt;
    events.push({
      id: `added-${inv.id}`,
      type: 'added',
      label: `Added ${cardDef.name} to collection`,
      timestamp: addedAt,
    });

    // Only surface a "favorited" event if the card is currently favorited
    // and the updatedAt timestamp is meaningfully after it was added —
    // otherwise it's likely just the initial createdAt/updatedAt being
    // equal on creation, not a real later edit.
    if (inv.is_favorite && inv.updatedAt > addedAt) {
      events.push({
        id: `favorited-${inv.id}`,
        type: 'favorited',
        label: `Favorited ${cardDef.name}`,
        timestamp: inv.updatedAt,
      });
    }
  });

  collections.forEach(col => {
    events.push({
      id: `collection-${col.id}`,
      type: 'collection_created',
      label: `Created collection ${col.name}`,
      timestamp: col.createdAt,
    });
  });

  // === Added to binder — binderSlot.createdAt is only set on initial
  // placement, not on later moves (see useBinderView.js previewMoveSlot /
  // reducer.js BINDER_SLOT_MOVE, neither touches createdAt) — so this
  // accurately represents "added to binder" and never "moved within
  // binder". ===
  binderSlots.forEach(slot => {
    const cardDef = cardDefMap[slot.cardDefId];
    const binder  = binderMap[slot.binderId];
    if (!cardDef || !binder) return;

    events.push({
      id: `slot-${slot.id}`,
      type: 'added_to_binder',
      label: `Added ${cardDef.name} to ${binder.name}`,
      timestamp: slot.createdAt,
    });
  });

  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}