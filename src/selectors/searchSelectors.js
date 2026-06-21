/**
 * @fileoverview Search selectors — multi-type search across cards,
 * collections, and binders.
 * === ISSUE #86: Search View Polish ===
 *
 * Collections and binders match by their own name OR by containing a
 * card that matches the query — so searching a card name surfaces its
 * parent collection/binder too, not just the card itself.
 */

const norm = (s) => (s ?? '').toLowerCase();

function cardMatchesQuery(card, q) {
  if (card.name.toLowerCase().includes(q)) return true;
  return Object.values(card.attributes ?? {}).some(
    v => typeof v === 'string' && v.toLowerCase().includes(q)
  );
}

/**
 * @returns {{ type: 'card', card: object }[]}
 */
export function searchCardResults(cardDefinitions, query) {
  const q = norm(query.trim());
  if (!q) return [];
  return cardDefinitions
    .filter(card => cardMatchesQuery(card, q))
    .map(card => ({ type: 'card', card }));
}

/**
 * @returns {{ type: 'collection', collection: object, matchedCardCount: number }[]}
 */
export function searchCollectionResults(collections, cardDefinitions, query) {
  const q = norm(query.trim());
  if (!q) return [];

  return collections
    .map(collection => {
      const nameMatches = collection.name.toLowerCase().includes(q);
      const collectionCards = cardDefinitions.filter(cd => cd.collectionId === collection.id);
      const matchedCards = collectionCards.filter(card => cardMatchesQuery(card, q));

      if (!nameMatches && matchedCards.length === 0) return null;
      return { type: 'collection', collection, matchedCardCount: matchedCards.length };
    })
    .filter(Boolean);
}

/**
 * @returns {{ type: 'binder', binder: object, matchedCardCount: number }[]}
 */
export function searchBinderResults(binders, binderSlots, cardDefinitions, query) {
  const q = norm(query.trim());
  if (!q) return [];

  const cardDefMap = {};
  cardDefinitions.forEach(cd => { cardDefMap[cd.id] = cd; });

  return binders
    .map(binder => {
      const nameMatches = binder.name.toLowerCase().includes(q);
      const placedCards = binderSlots
        .filter(s => s.binderId === binder.id)
        .map(s => cardDefMap[s.cardDefId])
        .filter(Boolean);
      const matchedCards = placedCards.filter(card => cardMatchesQuery(card, q));

      if (!nameMatches && matchedCards.length === 0) return null;
      return { type: 'binder', binder, matchedCardCount: matchedCards.length };
    })
    .filter(Boolean);
}

/**
 * Combines all three result types for the "All" tab, cards first, then
 * collections, then binders.
 */
export function searchAllResults(cardDefinitions, collections, binders, binderSlots, query) {
  return [
    ...searchCardResults(cardDefinitions, query),
    ...searchCollectionResults(collections, cardDefinitions, query),
    ...searchBinderResults(binders, binderSlots, cardDefinitions, query),
  ];
}