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
import { Button, EmptyState, StatCard, useCountUp } from '../ui/index.jsx';
import { CreateBinderModal } from '../modals/BinderModals.jsx';
import { ACTIONS } from '../../store/index.js';
import { useStore, useDispatch } from '../../hooks/useStore.js';
import { binderCapacity, relativeDate } from '../../utils/index.js';
import { getOwnedFilledSlotCount } from '../../selectors/binderSelectors.js';
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
  const binderPanels    = useStore(s => s.binderPanels ?? []);
  const inventory       = useStore(s => s.inventory);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const collections     = useStore(s => s.collections);
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
    () => getRecentlyAddedCards(inventory, cardDefinitions, 12),
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
            <StatCard value={stats.totalCards}     label="total cards"    icon="ti-cards"      tone="accent"  />
            <StatCard value={stats.totalBinders}    label="binders"       icon="ti-books"      tone="info"    />
            <StatCard value={stats.favorites}       label="favorites"     icon="ti-heart"      tone="danger"  />
            <StatCard value={stats.unorganised}     label="unorganised"   icon="ti-box"        tone="warning" />
            <StatCard value={stats.recentlyAdded}   label="recently added" icon="ti-sparkles"  tone="success" />
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
                cardCount={getOwnedFilledSlotCount(binderSlots, b.id, inventory, binderPanels)}
                capacity={binderCapacity(b, binderPanels)}
                onClick={() => onNavigate('binder', b.id)}
                onCustomizeCover={() => onNavigate('binder', b.id, null, true)}
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

  // === FIX (progress animation wasn't actually visible): the badge
  // number was static ({pct}% never changed), and the only thing that
  // ever animated was the 3px bar's width via a CSS transition — with
  // typical low percentages that's a 1-2px change, imperceptible in
  // practice. Reusing the same useCountUp hook the stat cards already
  // use makes BOTH the number and the bar animate together, driven by
  // the same live-counting value, over the same ~900ms window.
  const animatedPct = useCountUp(pct);

  // Mini-cover mirrors the real cover's stickers (actual saved
  // positions/rotations/scale) at a smaller size, so Home genuinely
  // previews the real cover instead of a simplified stand-in.
  //
  // === FIX (reference-image redesign): percent badge + progress bar
  // moved OFF the cover entirely and into the label area below,
  // alongside a real "X / Y cards" fraction — matching the reference's
  // layout, and simply more informative than a bare percentage. The
  // cover itself now carries two thin spine-ridge lines (suggesting
  // binder rings) and a few sparkle accents — a light decorative touch
  // in place of the reference's floral/vine illustration, per request
  // to skip the flowers specifically. Both are pure decoration
  // (aria-hidden), so a customized cover's own stickers still read as
  // the primary content — these sit behind/around them, not over. ===
  return (
    <div className="binder-card-wrapper">
      {/* style={{ color }} is needed here — the mini-cover's
          ::before/::after and hover box-shadow use currentColor,
          which without this falls back to black instead of the
          binder's actual cover_color. */}
      {/* === FIX (invalid HTML, hydration error): this was a real
          <button>, but it contains another real <button> below
          (the customize menu) — a button can never contain another
          button per the HTML spec, and React logged a hydration
          error over it. Converted to a div with the same click/
          keyboard/role/aria behavior a button already gives for
          free, so it's still fully clickable and accessible, just
          not literally a <button> element anymore. ===*/}
      <div
        className="binder-mini-cover"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${binder.name}`}
        style={{ color }}
      >
        <div
          className="binder-mini-cover-frame"
          style={{
            backgroundColor: color,
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
          }}
        >
          <span className="binder-mini-cover-spine-line binder-mini-cover-spine-line-1" aria-hidden="true" />
          <span className="binder-mini-cover-spine-line binder-mini-cover-spine-line-2" aria-hidden="true" />

          {/* width is a percentage of the cover's own width (matching
              sticker.size elsewhere), aspect-ratio:1 to stay square
              regardless of the cover's own shape. */}
          {(binder.stickers ?? []).map(sticker => (
            <MiniCoverSticker key={sticker.id} sticker={sticker} />
          ))}

          <button
            className="binder-mini-cover-menu-btn"
            onClick={(e) => { e.stopPropagation(); onCustomizeCover(); }}
            title="Customize cover"
            aria-label="Customize cover"
          >
            <i className="ti ti-brush" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {/* Binder name, card count, and progress always shown below the
          cover — matching the reference layout instead of overlaying
          this information on the cover itself. */}
      <div className="binder-cover-label">
        <div className="binder-cover-label-name">{binder.name}</div>
        <div className="binder-cover-label-meta">{cardCount} / {capacity} cards</div>
        <div className="binder-cover-label-progress">
          <div className="binder-cover-label-progress-track">
            <div className="binder-cover-label-progress-fill" style={{ width: `${animatedPct}%`, background: color }} />
          </div>
          <span className="binder-cover-label-progress-pct">{animatedPct}%</span>
        </div>
      </div>
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