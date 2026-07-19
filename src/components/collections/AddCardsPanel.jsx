/**
 * @fileoverview AddCardsPanel — persistent, draggable card picker for
 * placing cards into a binder.
 *
 * Replaces the old AddCardToBinderModal, which opened fresh (and had
 * to be reopened) for every single slot — pick a card, place it,
 * modal closes, click the next empty slot, repeat. This panel instead
 * stays open across as many placements as the user wants: drag any
 * card tile onto any empty slot in the binder to place it there, and
 * keep going. "Done" is the only thing that actually closes it.
 *
 * Cards are grouped by collection (matching the request to "organise
 * by collection") and rendered as real image tiles — same visual
 * language as CardGridItem.jsx's Collection grid (card-grid-item*
 * classes), just simplified (no favorite star, no owned/unowned
 * toggle — this is a picker, not the main collection view) and
 * draggable.
 *
 * Placement itself (parsing the drop payload, calling into the
 * reducer, picking which physical copy to link) lives in BinderView's
 * onDropEmpty handler, not here — this component only ever needs to
 * put a serializable {cardDefId, collectionId} payload onto the drag
 * event. Which specific copy gets linked (when more than one is
 * unplaced) is auto-picked by the reducer itself, the same fallback
 * that already runs whenever a caller doesn't request one deliberately.
 *
 * Known limitation: HTML5 drag-and-drop has no real support on touch
 * devices. Clicking an empty slot still opens/keeps this panel open
 * (see BinderView.jsx's onClickEmpty), but actually placing a card
 * currently requires a mouse drag.
 */

import { useMemo, useState } from 'react';
import { Button } from '../ui/index.jsx';
import { buildOwnershipMap, buildInventoryGroupMap, getQuantityOwned } from '../../selectors/inventorySelectors.js';
import { getFullyPlacedCardDefIds } from '../../selectors/binderSelectors.js';

export function AddCardsPanel({
  binder,
  cardDefinitions,
  collections,
  inventory,
  allBinderSlots,
  allBinderPanels,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(null); // null = All

  const ownershipMap      = useMemo(() => buildOwnershipMap(inventory), [inventory]);
  const inventoryGroupMap = useMemo(() => buildInventoryGroupMap(inventory), [inventory]);

  // Same "every owned copy already placed somewhere" check the old
  // modal used — a card with nothing left to place has no business
  // showing up in the picker at all.
  const fullyPlacedIds = useMemo(
    () => new Set(getFullyPlacedCardDefIds(allBinderSlots, allBinderPanels, inventory, binder.id)),
    [allBinderSlots, allBinderPanels, inventory, binder.id]
  );

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  // Available cards, grouped by collection — collections with no
  // matching cards left just don't get a section at all.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const available = cardDefinitions.filter(cd => {
      if (fullyPlacedIds.has(cd.id)) return false;
      if (!q) return true;
      if (cd.name.toLowerCase().includes(q)) return true;
      const col = collectionMap[cd.collectionId];
      return col?.name.toLowerCase().includes(q) ?? false;
    });

    const byCollection = {};
    available.forEach(cd => { (byCollection[cd.collectionId] ??= []).push(cd); });

    return collections
      .filter(c => byCollection[c.id]?.length)
      .filter(c => !selectedCollectionId || c.id === selectedCollectionId)
      .map(c => ({ collection: c, cards: byCollection[c.id] }));
  }, [cardDefinitions, collections, collectionMap, fullyPlacedIds, query, selectedCollectionId]);

  // Only offer collections that actually have something left to place
  // at all (ignoring the search query) — no point showing a pill for
  // a collection that's fully placed already.
  const collectionsWithAvailableCards = useMemo(() => {
    const availableCardDefIds = new Set(
      cardDefinitions.filter(cd => !fullyPlacedIds.has(cd.id)).map(cd => cd.collectionId)
    );
    return collections.filter(c => availableCardDefIds.has(c.id));
  }, [cardDefinitions, collections, fullyPlacedIds]);

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardDefId:    card.id,
      collectionId: card.collectionId,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="add-cards-panel" role="complementary" aria-label="Add cards to binder">
      <div className="add-cards-panel-header">
        <div>
          <h2 className="add-cards-panel-title">Add Cards</h2>
          <p className="add-cards-panel-subtitle">Drag a card onto any empty slot</p>
        </div>
        <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
      </div>

      {collectionsWithAvailableCards.length > 1 && (
        <div className="add-cards-panel-collection-tabs" role="tablist" aria-label="Filter by collection">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCollectionId === null}
            className={`add-cards-panel-collection-tab ${selectedCollectionId === null ? 'add-cards-panel-collection-tab-active' : ''}`}
            onClick={() => setSelectedCollectionId(null)}
          >
            All
          </button>
          {collectionsWithAvailableCards.map(c => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={selectedCollectionId === c.id}
              className={`add-cards-panel-collection-tab ${selectedCollectionId === c.id ? 'add-cards-panel-collection-tab-active' : ''}`}
              onClick={() => setSelectedCollectionId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="search-bar-wrapper add-cards-panel-search">
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search by card name or collection…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search cards"
        />
        {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>

      <div className="add-cards-panel-body">
        {groups.length === 0 && (
          <p className="empty-results">
            {query ? `No cards found for "${query}"` : 'Every card you own is already placed'}
          </p>
        )}

        {groups.map(({ collection, cards }) => (
          <div key={collection.id} className="add-cards-panel-group">
            <h3 className="add-cards-panel-group-title">{collection.name}</h3>
            <div className="card-grid add-cards-panel-grid">
              {cards.map(card => {
                const isOwned  = ownershipMap[card.id] !== undefined;
                const quantity = getQuantityOwned(inventoryGroupMap, card.id);
                return (
                  <div
                    key={card.id}
                    className={`card-grid-item add-cards-panel-tile ${isOwned ? 'card-grid-item-owned' : 'card-grid-item-not-owned'}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card)}
                    title={isOwned ? card.name : `${card.name} — not owned, will be placed as a grey placeholder`}
                  >
                    <div className="card-grid-item-image-wrapper">
                      {quantity > 1 && (
                        <span className="card-grid-item-quantity-badge">×{quantity}</span>
                      )}
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.name}
                          className={`card-grid-item-image ${!isOwned ? 'card-grid-item-image-grey' : ''}`}
                          draggable={false}
                        />
                      ) : (
                        <div className="card-grid-item-image-placeholder" aria-hidden="true">🃏</div>
                      )}
                      <span
                        className={`card-grid-item-status ${isOwned ? 'card-grid-item-status-owned' : 'card-grid-item-status-missing'}`}
                        title={isOwned ? 'Owned' : 'Not owned'}
                      >
                        {isOwned ? '✓' : '○'}
                      </span>
                    </div>
                    <div className="card-grid-item-info">
                      <span className="card-grid-item-name">{card.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}