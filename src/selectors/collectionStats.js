/**
 * @fileoverview Collection stats selector.
 *
 * WHY A SELECTOR:
 * The old approach called getStats(collectionId) per row, which
 * filtered cardDefinitions and inventory from scratch every time.
 * With N collections and M cards that's O(N×M) per render.
 *
 * This builds the entire stats map in a single O(M) pass.
 * Wrap in useMemo and it only recomputes when data actually changes.
 *
 * Usage:
 *   const statsMap = useMemo(
 *     () => buildCollectionStatsMap(collections, cardDefinitions, inventory),
 *     [collections, cardDefinitions, inventory]
 *   );
 *   const stats = statsMap[collectionId]; // O(1) lookup
 */

/**
 * Builds a stats map for all collections in a single pass.
 *
 * @param {object[]} collections
 * @param {object[]} cardDefinitions
 * @param {object[]} inventory
 * @returns {Record<string, { total: number, owned: number, missing: number, pct: number }>}
 */
export function buildCollectionStatsMap(collections, cardDefinitions, inventory) {
  // Decluttered cards act like they don't exist — same rule
  // CollectionDetailView applies when building collectionCards for
  // the Owned/Missing/Unorganised/Cards tabs and their summary. This
  // is the OTHER place a card count gets computed (the Collections
  // list view's per-collection tiles), so it needs the identical
  // exclusion or those tiles would never reflect a declutter at all.
  const activeCardDefinitions = cardDefinitions.filter(cd => !cd.isDecluttered);

  // Step 1: Count card definitions per collection — O(M)
  const totalMap = {};
  collections.forEach(c => { totalMap[c.id] = 0; });
  activeCardDefinitions.forEach(cd => {
    if (totalMap[cd.collectionId] !== undefined) {
      totalMap[cd.collectionId]++;
    }
  });

  // Step 2: Build a set of owned cardDefIds for O(1) lookup — O(I)
  const ownedCardDefIds = new Set(inventory.map(inv => inv.cardDefId));

  // Step 3: Count owned cards per collection — O(M)
  const ownedMap = {};
  collections.forEach(c => { ownedMap[c.id] = 0; });
  activeCardDefinitions.forEach(cd => {
    if (ownedCardDefIds.has(cd.id) && ownedMap[cd.collectionId] !== undefined) {
      ownedMap[cd.collectionId]++;
    }
  });

  // Step 4: Assemble final map — O(N)
  const statsMap = {};
  collections.forEach(c => {
    const total   = totalMap[c.id] ?? 0;
    const owned   = ownedMap[c.id] ?? 0;
    const missing = total - owned;
    const pct     = total > 0 ? Math.round((owned / total) * 100) : 0;
    statsMap[c.id] = { total, owned, missing, pct };
  });

  return statsMap;
}