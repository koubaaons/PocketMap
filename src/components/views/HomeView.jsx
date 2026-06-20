// === ISSUE #1 START: Split Views — HomeView ===
// === ISSUE #81 START: Binder Color Picker — use cover_color on binder cards ===
// === ISSUE #83 START: Home Dashboard ===
//   - 5 stat cards (Total Cards, Binders, Favorites, Unorganised, Recently Added)
//   - Recently Added section — last 5 owned cards
//   - Recent Activity feed — derived from existing timestamps, see
//     selectors/homeStats.js for why this isn't a real event log
//   - "View All" link for binders

import { useState, useCallback, useMemo } from 'react';
import { Button, EmptyState, StatCard } from '../ui/index.jsx';
import { CreateBinderModal } from '../modals/index.js';
import { ACTIONS } from '../../store/index.js';
import { useDispatch } from '../../hooks/useStore.js';
import { binderCapacity, relativeDate } from '../../utils/index.js';
import { getFilledSlotCount } from '../../selectors/binderSelectors.js';
import { buildHomeStats, getRecentlyAddedCards, getRecentActivity } from '../../selectors/homeStats.js';
import { DEFAULT_BINDER_COLOR } from '../../types/index.js';

const MAX_BINDERS_SHOWN = 4;

/**
 * @param {string} [mode='dashboard'] - 'dashboard' shows the capped binder
 *   grid plus stats/recently-added/activity widgets. 'all-binders' shows
 *   every binder, unpaginated, with none of the dashboard widgets — this
 *   is what the dashboard's "View All" link navigates to (route: 'binders').
 */
export function HomeView({ binders, binderSlots = [], inventory = [], cardDefinitions = [], collections = [], bin, toast, onNavigate, mode = 'dashboard' }) {
  const dispatch = useDispatch();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = useCallback((binder) => {
    dispatch({ type: ACTIONS.BINDER_ADD, payload: binder });
    toast(`Binder "${binder.name}" created`);
    setShowCreate(false);
  }, [dispatch, toast]);

  const isDashboard = mode === 'dashboard';

  const stats = useMemo(
    () => buildHomeStats(binders, cardDefinitions, inventory, binderSlots),
    [binders, cardDefinitions, inventory, binderSlots]
  );

  const recentlyAddedCards = useMemo(
    () => getRecentlyAddedCards(inventory, cardDefinitions, 5),
    [inventory, cardDefinitions]
  );

  const recentActivity = useMemo(
    () => getRecentActivity(inventory, cardDefinitions, collections, binderSlots, binders, 8),
    [inventory, cardDefinitions, collections, binderSlots, binders]
  );

  // Dashboard caps the grid and offers "View All"; all-binders mode shows
  // everything with no cap and no link back to itself.
  const visibleBinders = isDashboard ? binders.slice(0, MAX_BINDERS_SHOWN) : binders;
  const hasMoreBinders  = isDashboard && binders.length > MAX_BINDERS_SHOWN;

  return (
    <div className="view">
      {isDashboard && (
        <div className="view-header">
          <div className="stat-row">
            <StatCard value={stats.totalCards}     label="total cards"   />
            <StatCard value={stats.totalBinders}    label="binders"       />
            <StatCard value={stats.favorites}       label="favorites"     />
            <StatCard value={stats.unorganised}     label="unorganised"   />
            <StatCard value={stats.recentlyAdded}   label="recently added" />
          </div>
        </div>
      )}

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
            <h3 className="section-title">{isDashboard ? 'Your Binders' : 'All Binders'}</h3>
            <div className="section-header-actions">
              {hasMoreBinders && (
                <button className="view-all-link" onClick={() => onNavigate('binders')}>
                  View All
                </button>
              )}
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Binder</Button>
            </div>
          </div>
          <div className="binders-grid">
            {visibleBinders.map(b => (
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

      {/* === ISSUE #83: Recently Added + Recent Activity — dashboard only === */}
      {isDashboard && (recentlyAddedCards.length > 0 || recentActivity.length > 0) && (
        <div className="home-dashboard-row">
          {recentlyAddedCards.length > 0 && (
            <div className="home-dashboard-panel">
              <h3 className="section-title">Recently Added</h3>
              <div className="recently-added-strip">
                {recentlyAddedCards.map(({ inventoryItem, cardDef }) => (
                  <button
                    key={inventoryItem.id}
                    className="recently-added-thumb"
                    onClick={() => onNavigate('collection', cardDef.collectionId)}
                    title={cardDef.name}
                  >
                    {cardDef.image_url ? (
                      <img src={cardDef.image_url} alt={cardDef.name} />
                    ) : (
                      <span className="recently-added-thumb-fallback">{cardDef.name}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="home-dashboard-panel">
              <h3 className="section-title">Recent Activity</h3>
              <ul className="activity-feed">
                {recentActivity.map(event => (
                  <li key={event.id} className="activity-feed-item">
                    <span className={`activity-feed-dot activity-feed-dot-${event.type}`} />
                    <span className="activity-feed-label">{event.label}</span>
                    <span className="activity-feed-time">{relativeDate(event.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateBinderModal onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function BinderCard({ binder, cardCount, capacity, onClick }) {
  const pct   = capacity > 0 ? Math.round((cardCount / capacity) * 100) : 0;
  // === ISSUE #81: use cover_color, fall back to default for old binders ===
  const color = binder.cover_color ?? DEFAULT_BINDER_COLOR;

  return (
    <button className="binder-card" onClick={onClick}>
      {/* Spine uses the binder color */}
      <div className="binder-spine" style={{ background: color }} />
      <div className="binder-card-body">
        <div className="binder-card-name">{binder.name}</div>
        <div className="binder-card-meta">
          {binder.pages} pages · {binder.rows}×{binder.cols} grid
        </div>
        <div className="binder-progress-bar">
          <div
            className="binder-progress-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <div className="binder-card-count">{cardCount} / {capacity} cards · {pct}%</div>
      </div>
    </button>
  );
}

// === ISSUE #83 END: Home Dashboard ===
// === ISSUE #81 END: Binder Color Picker ===
// === ISSUE #1 END: Split Views — HomeView ===