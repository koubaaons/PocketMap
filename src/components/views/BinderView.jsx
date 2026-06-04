import { useState, useCallback, useMemo } from 'react';
import { Button } from '../ui/index.jsx';
import { AddCardModal, EditCardModal, CardDetailModal } from '../modals/index.js';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { binderCapacity, cardsOnPage } from '../../utils/index.js';

export function BinderView({ binder, cards, allCards, toast }) {
  const dispatch = useDispatch();
  const [page, setPage] = useState(1);
  const [addSlot, setAddSlot] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [editing, setEditing] = useState(false);

  const safePage = Math.min(page, binder.pages);
  const pageCards = useMemo(() => cardsOnPage(cards, binder.id, safePage), [cards, binder.id, safePage]);
  const totalSlots = binder.rows * binder.cols;

  const handleAddCard = useCallback((card) => {
    dispatch({ type: ACTIONS.CARD_ADD, payload: card });
    toast(`"${card.name}" added`);
    setAddSlot(null);
    setPage(card.page);
  }, [dispatch, toast]);

  const handleUpdateCard = useCallback((updated) => {
    dispatch({ type: ACTIONS.CARD_UPDATE, payload: updated });
    toast('Card updated');
    setEditing(false);
    setActiveCard(updated);
  }, [dispatch, toast]);

  const handleDeleteCard = useCallback((cardId) => {
    dispatch({ type: ACTIONS.CARD_DELETE, payload: { cardId } });
    toast('Card moved to trash');
    setActiveCard(null);
  }, [dispatch, toast]);

  const handleToggleFav = useCallback((card) => {
    const updated = { ...card, favorite: !card.favorite };
    dispatch({ type: ACTIONS.CARD_UPDATE, payload: updated });
    toast(updated.favorite ? 'Added to favorites' : 'Removed from favorites');
    setActiveCard(updated);
  }, [dispatch, toast]);

  const filled = cards.filter(c => c.binderId === binder.id).length;
  const cap = binderCapacity(binder);

  return (
    <div className="view">
      <div className="page-nav-bar">
        <div className="page-nav-controls">
          <Button variant="icon" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>←</Button>
          <span className="page-label">Page {safePage} of {binder.pages}</span>
          <Button variant="icon" size="sm" onClick={() => setPage(p => Math.min(binder.pages, p + 1))} disabled={safePage >= binder.pages}>→</Button>
        </div>
        <div className="page-jumper">
          {Array.from({ length: Math.min(binder.pages, 30) }, (_, i) => (
            <button key={i + 1} className={`page-pip ${safePage === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>
              {i + 1}
            </button>
          ))}
          {binder.pages > 30 && <span className="page-more">+{binder.pages - 30} more</span>}
        </div>
        <span className="page-fill-count">{filled}/{cap}</span>
      </div>

      <div className="binder-page-wrapper">
        <div className="binder-page-label">Page {safePage}</div>
        <div className="slots-grid" style={{ gridTemplateColumns: `repeat(${binder.cols}, 1fr)` }}>
          {Array.from({ length: totalSlots }, (_, i) => {
            const slotNum = i + 1;
            const card = pageCards.find(c => c.slot === slotNum);
            return (
              <SlotCell
                key={slotNum}
                slotNum={slotNum}
                card={card}
                onClickCard={() => setActiveCard(card)}
                onClickEmpty={() => setAddSlot({ page: safePage, slot: slotNum })}
              />
            );
          })}
        </div>
      </div>

      {addSlot && (
        <AddCardModal binder={binder} cards={allCards} initialPage={addSlot.page} initialSlot={addSlot.slot}
          onSubmit={handleAddCard} onClose={() => setAddSlot(null)} />
      )}
      {activeCard && !editing && (
        <CardDetailModal card={activeCard} binderName={binder.name}
          onEdit={() => setEditing(true)} onDelete={() => handleDeleteCard(activeCard.id)}
          onToggleFavorite={() => handleToggleFav(activeCard)} onClose={() => setActiveCard(null)} />
      )}
      {activeCard && editing && (
        <EditCardModal card={activeCard} onSubmit={handleUpdateCard} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function SlotCell({ slotNum, card, onClickCard, onClickEmpty }) {
  if (card) {
    return (
      <button className="slot slot-filled" onClick={onClickCard}>
        {card.favorite && <span className="slot-fav-star" aria-label="Favorite">★</span>}
        <span className="slot-num">{slotNum}</span>
        <span className="slot-card-name">{card.name}</span>
        {card.character && <span className="slot-card-char">{card.character}</span>}
      </button>
    );
  }
  return (
    <button className="slot slot-empty" onClick={onClickEmpty} aria-label={`Add card to slot ${slotNum}`}>
      <span className="slot-num">{slotNum}</span>
      <span className="slot-empty-text">+</span>
    </button>
  );
}