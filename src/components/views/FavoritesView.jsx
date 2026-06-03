import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { EditCardModal, CardDetailModal } from '../modals/index.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';

export function FavoritesView({ cards, binders, toast }) {
  const dispatch = useDispatch();
  const [activeCard, setActiveCard] = useState(null);
  const [editing, setEditing] = useState(false);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => map[b.id] = b);
    return map;
  }, [binders]);

  const favorites = useMemo(() => cards.filter(c => c.favorite), [cards]);

  const handleToggleFav = (card) => {
    const updated = { ...card, favorite: false };
    dispatch({ type: ACTIONS.CARD_UPDATE, payload: updated });
    toast('Removed from favorites');
    setActiveCard(null);
  };

  const handleDelete = (cardId) => {
    dispatch({ type: ACTIONS.CARD_DELETE, payload: { cardId } });
    toast('Card moved to trash');
    setActiveCard(null);
  };

  const handleUpdate = (updated) => {
    dispatch({ type: ACTIONS.CARD_UPDATE, payload: updated });
    toast('Card updated');
    setEditing(false);
    setActiveCard(updated);
  };

  if (favorites.length === 0) {
    return (
      <div className="view">
        <EmptyState icon="★" title="No favorites yet" subtitle="Open any card and mark it as a favorite" />
      </div>
    );
  }

  return (
    <div className="view">
      <p className="search-count">{favorites.length} favorite{favorites.length !== 1 ? 's' : ''}</p>
      <div className="results-list">
        {favorites.map(card => {
          const b = binderMap[card.binderId];
          return (
            <button key={card.id} className="result-row" onClick={() => setActiveCard(card)}>
              <div className="result-info">
                <span className="result-name">★ {card.name}</span>
                <span className="result-meta">
                  {card.character && <><strong>{card.character}</strong> · </>}
                  {card.series && <span className="result-series">{card.series} · </span>}
                  {b?.name ?? '—'} · Page {card.page} · Slot {card.slot}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activeCard && !editing && (
        <CardDetailModal card={activeCard} binderName={binderMap[activeCard.binderId]?.name ?? '—'}
          onEdit={() => setEditing(true)} onDelete={() => handleDelete(activeCard.id)}
          onToggleFavorite={() => handleToggleFav(activeCard)} onClose={() => setActiveCard(null)} />
      )}
      {activeCard && editing && (
        <EditCardModal card={activeCard} onSubmit={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
