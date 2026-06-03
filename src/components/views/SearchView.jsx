import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { EditCardModal, CardDetailModal } from '../modals/index.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { searchCards } from '../../utils/index.js';

export function SearchView({ cards, binders, toast, onNavigateToBinder }) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [activeCard, setActiveCard] = useState(null);
  const [editing, setEditing] = useState(false);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => map[b.id] = b);
    return map;
  }, [binders]);

  const results = useMemo(() => searchCards(cards, query), [cards, query]);

  const handleToggleFav = (card) => {
    const updated = { ...card, favorite: !card.favorite };
    dispatch({ type: ACTIONS.CARD_UPDATE, payload: updated });
    toast(updated.favorite ? 'Added to favorites' : 'Removed from favorites');
    setActiveCard(updated);
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

  return (
    <div className="view">
      <div className="search-bar-wrapper">
        <span className="search-icon">◎</span>
        <input className="search-input" placeholder="Search by name, character, or series…"
          value={query} onChange={e => setQuery(e.target.value)} autoFocus aria-label="Search cards" />
        {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>}
      </div>

      {!query && <p className="search-hint">Start typing to search across all {cards.length} cards…</p>}
      {query && results.length === 0 && (
        <EmptyState icon="◎" title={`No results for "${query}"`} subtitle="Try a different name, character, or series" />
      )}
      {results.length > 0 && (
        <>
          <p className="search-count">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          <div className="results-list">
            {results.map(card => {
              const b = binderMap[card.binderId];
              return (
                <button key={card.id} className="result-row" onClick={() => setActiveCard(card)}>
                  <div className="result-info">
                    <span className="result-name">{card.name}</span>
                    <span className="result-meta">
                      {card.character && <><strong>{card.character}</strong> · </>}
                      {card.series && <span className="result-series">{card.series} · </span>}
                      {b?.name ?? 'Unknown Binder'}
                    </span>
                  </div>
                  <div className="result-loc">
                    <span className="loc-badge">p.{card.page} s.{card.slot}</span>
                    {card.favorite && <span className="fav-star">★</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

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
