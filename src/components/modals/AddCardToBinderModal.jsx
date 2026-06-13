/**
 * @fileoverview AddCardToBinderModal — search cards from collections and place in binder slot.
 */

// === ISSUE #54 START: Add Card to Binder from Collection ===

import { useState, useMemo } from 'react';
import { Modal, ModalActions, Button } from '../ui/index.jsx';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { getPlacedCardDefIds, filterCardsForBinder } from '../../selectors/binderSelectors.js';

export function AddCardToBinderModal({
  binder, pageNumber, slotIndex,
  cardDefinitions, collections, templateFields, inventory, binderSlots,
  onSubmit, onClose,
}) {
  const [query, setQuery]               = useState('');
  const [selectedCard, setSelectedCard] = useState(null);

  const ownershipMap  = useMemo(() => buildOwnershipMap(inventory), [inventory]);
  const placedCardIds = useMemo(() => getPlacedCardDefIds(binderSlots, binder.id), [binderSlots, binder.id]);

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  // === REFACTOR7b START: use filterCardsForBinder selector ===
  const results = useMemo(
    () => filterCardsForBinder(cardDefinitions, placedCardIds, query, collectionMap),
    [cardDefinitions, placedCardIds, query, collectionMap]
  );
  // === REFACTOR7b END ===

  const handleConfirm = () => {
    if (!selectedCard) return;
    onSubmit(selectedCard, selectedCard.collectionId);
  };

  return (
    <Modal title={`Add Card — Page ${pageNumber}, Slot ${slotIndex + 1}`} onClose={onClose}>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Search your collections to find a card to place here.
        Unowned cards will appear as grey placeholders.
      </p>

      <div className="search-bar-wrapper" style={{ marginBottom: 12 }}>
        <span className="search-icon">◎</span>
        <input className="search-input" placeholder="Search by card name or collection…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedCard(null); }}
          autoFocus aria-label="Search cards" />
        {query && <button className="search-clear" onClick={() => { setQuery(''); setSelectedCard(null); }}>✕</button>}
      </div>

      <div className="add-to-binder-results">
        {results.length === 0 && query && <p className="empty-results">No cards found for "{query}"</p>}
        {results.length === 0 && !query && <p className="empty-results">Start typing to search your cards</p>}
        {results.map(card => {
          const isOwned    = ownershipMap[card.id] !== undefined;
          const collection = collectionMap[card.collectionId];
          const isSelected = selectedCard?.id === card.id;
          return (
            <button key={card.id}
              className={`add-to-binder-row ${isSelected ? 'selected' : ''} ${!isOwned ? 'unowned' : ''}`}
              onClick={() => setSelectedCard(card)}>
              <div className="atb-card-info">
                <span className="atb-card-name">{card.name}</span>
                <span className="atb-card-collection">{collection?.name ?? '—'}</span>
              </div>
              <span className={`atb-owned-badge ${isOwned ? 'owned' : 'not-owned'}`}>
                {isOwned ? '✓ Owned' : '○ Not owned'}
              </span>
            </button>
          );
        })}
      </div>

      {selectedCard && (
        <div className="atb-selected-summary">
          <span>Placing: <strong>{selectedCard.name}</strong></span>
          {!ownershipMap[selectedCard.id] && (
            <span className="atb-placeholder-warning"> — will appear as grey placeholder</span>
          )}
        </div>
      )}

      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!selectedCard}>Place Card</Button>
      </ModalActions>
    </Modal>
  );
}

// === ISSUE #54 END: Add Card to Binder ===