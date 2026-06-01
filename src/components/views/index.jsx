/**
 * @fileoverview Page-level view components.
 *
 * Each view is a self-contained component that reads from the store
 * and dispatches actions. They compose UI primitives and modals.
 */

import { useState, useCallback, useMemo } from 'react';
import { Button, EmptyState, StatCard, Badge, ConfirmModal } from '../ui/index.jsx';
import { CreateBinderModal, AddCardModal, EditCardModal, CardDetailModal } from '../modals/index.jsx';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import {
  binderCapacity, binderCardCount, cardsOnPage,
  searchCards, availableSlots, relativeDate, debounce
} from '../../utils/index.js';

// ─── Home View ────────────────────────────────────────────────────────────────

export function HomeView({ binders, cards, bin, toast, onNavigate }) {
  const dispatch = useDispatch();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = useCallback((binder) => {
    dispatch({ type: ACTIONS.BINDER_ADD, payload: binder });
    toast(`Binder "${binder.name}" created`);
    setShowCreate(false);
  }, [dispatch, toast]);

  return (
    <div className="view">
      <div className="view-header">
        <div className="stat-row">
          <StatCard value={binders.length} label="binders" />
          <StatCard value={cards.length} label="cards" />
          <StatCard value={cards.filter(c => c.favorite).length} label="favorites" />
          <StatCard value={bin.length} label="in trash" />
        </div>
      </div>

      {binders.length === 0 ? (
        <EmptyState
          icon="📒"
          title="No binders yet"
          subtitle="Create your first binder to start organizing your collection"
          action={<Button variant="primary" onClick={() => setShowCreate(true)}>+ Create Binder</Button>}
        />
      ) : (
        <>
          <div className="section-header">
            <h3 className="section-title">Your Binders</h3>
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Binder</Button>
          </div>
          <div className="binders-grid">
            {binders.map(b => (
              <BinderCard
                key={b.id}
                binder={b}
                cardCount={binderCardCount(cards, b.id)}
                capacity={binderCapacity(b)}
                onClick={() => onNavigate('binder', b.id)}
              />
            ))}
          </div>
        </>
      )}

      {showCreate && (
        <CreateBinderModal onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function BinderCard({ binder, cardCount, capacity, onClick }) {
  const pct = capacity > 0 ? Math.round((cardCount / capacity) * 100) : 0;
  return (
    <button className="binder-card" onClick={onClick}>
      <div className="binder-spine" />
      <div className="binder-card-body">
        <div className="binder-card-name">{binder.name}</div>
        <div className="binder-card-meta">
          {binder.pages} pages · {binder.rows}×{binder.cols} grid
        </div>
        <div className="binder-progress-bar">
          <div className="binder-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="binder-card-count">{cardCount} / {capacity} cards</div>
      </div>
    </button>
  );
}

// ─── Binder View ──────────────────────────────────────────────────────────────

export function BinderView({ binder, cards, allCards, toast }) {
  const dispatch = useDispatch();
  const [page, setPage] = useState(1);
  const [addSlot, setAddSlot] = useState(null); // { page, slot } | null
  const [activeCard, setActiveCard] = useState(null); // card | null
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

  const binderCards = cards.filter(c => c.binderId === binder.id);
  const filled = binderCards.length;
  const cap = binderCapacity(binder);

  return (
    <div className="view">
      {/* Page navigation */}
      <div className="page-nav-bar">
        <div className="page-nav-controls">
          <Button variant="icon" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>←</Button>
          <span className="page-label">Page {safePage} of {binder.pages}</span>
          <Button variant="icon" size="sm" onClick={() => setPage(p => Math.min(binder.pages, p + 1))} disabled={safePage >= binder.pages}>→</Button>
        </div>
        <div className="page-jumper">
          {Array.from({ length: Math.min(binder.pages, 30) }, (_, i) => (
            <button
              key={i + 1}
              className={`page-pip ${safePage === i + 1 ? 'active' : ''}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          {binder.pages > 30 && <span className="page-more">+{binder.pages - 30} more</span>}
        </div>
        <span className="page-fill-count">{filled}/{cap}</span>
      </div>

      {/* Slot grid */}
      <div className="binder-page-wrapper">
        <div className="binder-page-label">Page {safePage}</div>
        <div
          className="slots-grid"
          style={{ gridTemplateColumns: `repeat(${binder.cols}, 1fr)` }}
        >
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

      {/* Add Card Modal */}
      {addSlot && (
        <AddCardModal
          binder={binder}
          cards={allCards}
          initialPage={addSlot.page}
          initialSlot={addSlot.slot}
          onSubmit={handleAddCard}
          onClose={() => setAddSlot(null)}
        />
      )}

      {/* Card Detail Modal */}
      {activeCard && !editing && (
        <CardDetailModal
          card={activeCard}
          binderName={binder.name}
          onEdit={() => setEditing(true)}
          onDelete={() => handleDeleteCard(activeCard.id)}
          onToggleFavorite={() => handleToggleFav(activeCard)}
          onClose={() => setActiveCard(null)}
        />
      )}

      {/* Edit Modal */}
      {activeCard && editing && (
        <EditCardModal
          card={activeCard}
          onSubmit={handleUpdateCard}
          onClose={() => setEditing(false)}
        />
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

// ─── Search View ──────────────────────────────────────────────────────────────

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
        <input
          className="search-input"
          placeholder="Search by name, character, or series…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          aria-label="Search cards"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
        )}
      </div>

      {!query && (
        <p className="search-hint">Start typing to search across all {cards.length} cards…</p>
      )}

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
        <CardDetailModal
          card={activeCard}
          binderName={binderMap[activeCard.binderId]?.name ?? '—'}
          onEdit={() => setEditing(true)}
          onDelete={() => handleDelete(activeCard.id)}
          onToggleFavorite={() => handleToggleFav(activeCard)}
          onClose={() => setActiveCard(null)}
        />
      )}
      {activeCard && editing && (
        <EditCardModal card={activeCard} onSubmit={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

// ─── Favorites View ───────────────────────────────────────────────────────────

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
        <CardDetailModal
          card={activeCard}
          binderName={binderMap[activeCard.binderId]?.name ?? '—'}
          onEdit={() => setEditing(true)}
          onDelete={() => handleDelete(activeCard.id)}
          onToggleFavorite={() => handleToggleFav(activeCard)}
          onClose={() => setActiveCard(null)}
        />
      )}
      {activeCard && editing && (
        <EditCardModal card={activeCard} onSubmit={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

// ─── Bin View ─────────────────────────────────────────────────────────────────

export function BinView({ bin, binders, toast }) {
  const dispatch = useDispatch();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => map[b.id] = b);
    return map;
  }, [binders]);

  const handleRestore = useCallback((card) => {
    const binderExists = binders.some(b => b.id === card.binderId);
    if (!binderExists) { toast('Binder no longer exists — cannot restore', 'error'); return; }
    dispatch({ type: ACTIONS.BIN_RESTORE, payload: { cardId: card.id } });
    toast(`"${card.name}" restored`);
  }, [binders, dispatch, toast]);

  const handlePermDelete = useCallback((cardId) => {
    dispatch({ type: ACTIONS.BIN_DELETE, payload: { cardId } });
    toast('Deleted permanently', 'info');
  }, [dispatch, toast]);

  if (bin.length === 0) {
    return (
      <div className="view">
        <EmptyState icon="🗑" title="Trash is empty" subtitle="Deleted cards appear here. You can restore or permanently delete them." />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="section-header">
        <p className="search-count">{bin.length} item{bin.length !== 1 ? 's' : ''} in trash</p>
        <Button variant="danger" size="sm" onClick={() => setConfirmEmpty(true)}>Empty Bin</Button>
      </div>

      <div className="bin-list">
        {bin.map(card => {
          const b = binderMap[card.binderId];
          return (
            <div key={card.id} className="bin-row">
              <div className="bin-info">
                <span className="bin-name">{card.name}</span>
                <span className="bin-meta">
                  {card.character && <>{card.character} · </>}
                  {b ? b.name : 'Binder deleted'} · Deleted {relativeDate(card.deletedAt)}
                </span>
              </div>
              <div className="bin-actions">
                <Button variant="ghost" size="sm" onClick={() => handleRestore(card)}>Restore</Button>
                <Button variant="danger" size="sm" onClick={() => handlePermDelete(card.id)}>Delete Forever</Button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmEmpty && (
        <ConfirmModal
          title="Empty trash?"
          message={`This will permanently delete all ${bin.length} item${bin.length !== 1 ? 's' : ''}. This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={() => { dispatch({ type: ACTIONS.BIN_EMPTY }); toast('Trash emptied'); }}
          onClose={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  );
}