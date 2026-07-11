// === ISSUE #1 START: Split Views — HomeView ===
// === ISSUE #81 START: Binder Color Picker — use cover_color on binder cards ===
// === ISSUE #83 START: Home Dashboard ===
//   - 5 stat cards (Total Cards, Binders, Favorites, Unorganised, Recently Added)
//   - Recently Added section — last 5 owned cards
//   - Recent Activity feed — derived from existing timestamps, see
//     selectors/homeStats.js for why this isn't a real event log
//   - "View All" link for binders
// === ISSUE #92 START: Customize Cover — hover-revealed button on BinderCard ===

import { useState, useCallback, useMemo } from 'react';
import { Button, EmptyState, StatCard } from '../ui/index.jsx';
import { CreateBinderModal } from '../modals/index.js';
import { ACTIONS } from '../../store/index.js';
import { useStore, useDispatch } from '../../hooks/useStore.js';
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
export function HomeView({ toast, onNavigate, mode = 'dashboard' }) {
  const binders         = useStore(s => s.binders);
  const binderSlots     = useStore(s => s.binderSlots ?? []);
  const inventory       = useStore(s => s.inventory);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const collections     = useStore(s => s.collections);
  const bin             = useStore(s => s.bin);
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
                onCustomizeCover={() => onNavigate('binder', b.id)}
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

function BinderCard({ binder, cardCount, capacity, onClick, onCustomizeCover }) {
  const pct   = capacity > 0 ? Math.round((cardCount / capacity) * 100) : 0;
  // === ISSUE #81: use cover_color, fall back to default for old binders ===
  const color = binder.cover_color ?? DEFAULT_BINDER_COLOR;

  // === ISSUE #94: mini-cover replaces the old flat rectangle entirely —
  // reuses the same visual recipe as the real cover (binder-cover-frame:
  // gradient sheen, inset shadows, rounded corners) at a smaller scale,
  // with stickers rendered in their actual saved positions/rotations/
  // scale so the home grid genuinely previews what the real cover looks
  // like, not a simplified stand-in. ===
  return (
    <div className="binder-card-wrapper">
      {/* === FIX: style={{ color }} added here — this was missing
          entirely. The 3D mini-cover effect's CSS (rear-cover fill,
          hover glow) uses currentColor on .binder-mini-cover's own
          ::before/::after pseudo-elements and on .binder-mini-cover-
          frame's hover box-shadow, all of which need `color` set HERE,
          on this exact button, to resolve to the binder's actual
          cover_color. Without it, color falls back to its default
          (black), which is exactly why the rear edge and hover glow
          were rendering solid black instead of the binder's pink. === */}
      <button className="binder-mini-cover" onClick={onClick} aria-label={`Open ${binder.name}`} style={{ color }}>
        <div
          className="binder-mini-cover-frame"
          style={{
            backgroundColor: color,
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
          }}
        >
          {/* === ISSUE #94 FIX: width now a percentage of the mini
              cover's own width (same sticker.size field used
              everywhere else), with aspect-ratio:1 to stay square
              regardless of the cover's own taller-than-wide shape —
              previously a fixed 24px here was just as disconnected
              from the actual rendered size as the real cover's old
              fixed 56px was. === */}
          {(binder.stickers ?? []).map(sticker => (
            <MiniCoverSticker key={sticker.id} sticker={sticker} />
          ))}

          <div className="binder-mini-cover-progress">
            <div className="binder-mini-cover-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>

      {/* Binder name and meta always shown below the cover */}
      <div className="binder-cover-label">
        <div className="binder-cover-label-name">{binder.name}</div>
        <div className="binder-cover-label-meta">{binder.pages}p · {pct}%</div>
      </div>

      {/* === ISSUE #92: hover-revealed customize button — only visible
          on hover via CSS (.binder-card-customize-btn), stopPropagation
          so it doesn't also trigger onClick (navigating into the
          binder) when clicked. === */}
      <button
        className="binder-card-customize-btn"
        onClick={(e) => { e.stopPropagation(); onCustomizeCover(); }}
        title="Customize cover"
        aria-label="Customize cover"
      >
        🎨
      </button>
    </div>
  );
}

// === FIX: a tall/narrow source image (e.g. a standing character with
// most of its width unused) inside a forced aspectRatio:'1' box gets
// shrunk dramatically by object-fit:contain to fit the box's narrower
// dimension — leaving visible empty space above/below and making it
// look much smaller than a squarer image at the IDENTICAL stored
// scale, even though the math/data was never wrong. Rather than special
// -case any specific image, this component measures whatever image is
// actually uploaded (via the img's own onLoad — naturalWidth/
// naturalHeight, the same technique already used on the real cover's
// CustomizerSticker) and sizes the box to match THAT image's real
// shape automatically. Works the same way for every future upload —
// tall, wide, or square — with no per-image logic at all. ===
function MiniCoverSticker({ sticker }) {
  const [aspectRatio, setAspectRatio] = useState(1);

  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
  }, []);

  return (
    <div
      className="binder-mini-cover-sticker"
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: `${sticker.size ?? 17.5}%`,
        aspectRatio: `${aspectRatio}`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale ?? 1})`,
      }}
    >
      <img src={sticker.image_url} alt="" onLoad={handleImageLoad} />
    </div>
  );
}

// === ISSUE #92 END: Customize Cover ===
// === ISSUE #83 END: Home Dashboard ===
// === ISSUE #81 END: Binder Color Picker ===
// === ISSUE #1 END: Split Views — HomeView ===