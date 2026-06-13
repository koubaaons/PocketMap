// === ISSUE #1 START: Split Views — HomeView ===
// === ISSUE #58 START: Remove Legacy Card System — use binderSlots instead of cards ===

import { useState, useCallback, useMemo } from 'react';
import { Button, EmptyState, StatCard } from '../ui/index.jsx';
import { CreateBinderModal } from '../modals/index.js';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { binderCapacity } from '../../utils/index.js';
import { getFilledSlotCount } from '../../selectors/binderSelectors.js';

export function HomeView({ binders, binderSlots = [], inventory = [], cardDefinitions = [], bin, toast, onNavigate }) {
  const dispatch = useDispatch();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = useCallback((binder) => {
    dispatch({ type: ACTIONS.BINDER_ADD, payload: binder });
    toast(`Binder "${binder.name}" created`);
    setShowCreate(false);
  }, [dispatch, toast]);

  // Stats derived from new system
  const totalCards    = cardDefinitions.length;
  const totalOwned    = inventory.length;
  const totalFavorites = inventory.filter(inv => inv.is_favorite).length;

  return (
    <div className="view">
      <div className="view-header">
        <div className="stat-row">
          <StatCard value={binders.length}   label="binders"   />
          <StatCard value={totalCards}        label="cards"     />
          <StatCard value={totalFavorites}    label="favorites" />
          <StatCard value={bin.length}        label="in trash"  />
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
                cardCount={getFilledSlotCount(binderSlots, b.id)}
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

// === ISSUE #58 END: Remove Legacy Card System ===
// === ISSUE #1 END: Split Views — HomeView ===