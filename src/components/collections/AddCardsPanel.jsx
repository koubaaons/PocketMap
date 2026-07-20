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
 *
 * === Repositionable panel ===
 * The panel itself can be dragged (by its top grip bar) anywhere on
 * screen — it defaults to the top-right corner, but that corner can
 * sit on top of other UI (the binder's own Edit/Preview/+Page
 * toolbar, in particular), so it needs to be movable out of the way
 * rather than fixed there permanently. Position is plain component
 * state (not persisted) and clamped to stay fully on-screen; disabled
 * entirely on narrow/mobile layouts, where the panel is a full-width
 * bottom sheet instead (see add-cards-panel.css's mobile override).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
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

  // === Panel dragging — move the whole panel out of the way of
  // whatever it's covering (see file header comment). Position is
  // tracked in plain pixels from the top-left of the viewport;
  // defaults to the top-right corner on first render.
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const [position, setPosition] = useState(null); // null = use default CSS (top-right)
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = (x, y) => {
    const el = panelRef.current;
    const width  = el?.offsetWidth  ?? 380;
    const height = el?.offsetHeight ?? 400;
    return {
      x: Math.min(Math.max(x, 0), Math.max(0, window.innerWidth  - width)),
      y: Math.min(Math.max(y, 0), Math.max(0, window.innerHeight - height)),
    };
  };

  const getPointerCoords = (e) => {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const handleDragHandlePointerDown = (e) => {
    // Mobile layout is a fixed bottom sheet — dragging is a desktop-
    // only affordance (matches the CSS override that ignores position
    // on narrow viewports anyway).
    if (window.innerWidth <= 768) return;
    if (!e.touches) e.preventDefault(); // avoid selecting page text mid-drag
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const coords = getPointerCoords(e);
    dragState.current = {
      offsetX: coords.x - rect.left,
      offsetY: coords.y - rect.top,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const state = dragState.current;
      if (!state) return;
      const coords = getPointerCoords(e);
      setPosition(clampPosition(coords.x - state.offsetX, coords.y - state.offsetY));
    };
    const handleUp = () => {
      setIsDragging(false);
      dragState.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  // Re-clamp on viewport resize so the panel can't get stranded
  // off-screen if the window shrinks after it's been dragged.
  useEffect(() => {
    if (!position) return;
    const handleResize = () => setPosition(p => p ? clampPosition(p.x, p.y) : p);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // === Panel resizing — right/bottom edges plus a corner handle,
  // top-left stays fixed while any of them are dragged (matching
  // ordinary OS window-resize behavior). Resizing for the first time
  // "pins" the panel's current on-screen position into `position`
  // (if it hasn't been dragged yet and is still using the default
  // docked-to-the-top-right CSS) so the box doesn't visually jump the
  // instant a size is applied inline.
  const MIN_WIDTH  = 320;
  const MIN_HEIGHT = 280;

  const resizeState = useRef(null);
  const [size, setSize] = useState(null); // null = use default CSS sizing
  const [isResizing, setIsResizing] = useState(false);

  const maxWidth  = () => Math.min(900, window.innerWidth * 0.9);
  const maxHeight = () => window.innerHeight - 16;

  const clampSize = (width, height) => ({
    width:  Math.min(Math.max(width,  MIN_WIDTH),  maxWidth()),
    height: Math.min(Math.max(height, MIN_HEIGHT), maxHeight()),
  });

  const startResize = (e, axis) => {
    if (window.innerWidth <= 768) return; // mobile is a fixed-size bottom sheet
    if (!e.touches) e.preventDefault();
    e.stopPropagation(); // don't also trigger the drag handle underneath
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    // Pin the current position so resizing (which keeps top-left
    // fixed) has a fixed point to grow/shrink from, even if the
    // panel has never been dragged and is still docked via CSS.
    if (!position) setPosition({ x: rect.left, y: rect.top });

    const coords = getPointerCoords(e);
    resizeState.current = {
      axis, // 'width' | 'height' | 'both'
      startX: coords.x,
      startY: coords.y,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e) => {
      const state = resizeState.current;
      if (!state) return;
      const coords = getPointerCoords(e);
      const deltaX = coords.x - state.startX;
      const deltaY = coords.y - state.startY;
      const nextWidth  = state.axis !== 'height' ? state.startWidth  + deltaX : state.startWidth;
      const nextHeight = state.axis !== 'width'  ? state.startHeight + deltaY : state.startHeight;
      setSize(clampSize(nextWidth, nextHeight));
    };
    const handleUp = () => {
      setIsResizing(false);
      resizeState.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isResizing]);

  // Re-clamp on viewport resize, same reasoning as the position effect above.
  useEffect(() => {
    if (!size) return;
    const handleWindowResize = () => setSize(s => s ? clampSize(s.width, s.height) : s);
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [size]);

  // === Measure the panel's actual rendered width (not just the
  // `size` state) so the grid's column count can never disagree with
  // what's really on screen — state alone could momentarily drift
  // from the rendered box (clamping, the mobile CSS override forcing
  // width:100%, etc.), and that's exactly what let one row of cards
  // render narrower/wider than the row above it mid-resize.
  const [measuredWidth, setMeasuredWidth] = useState(380);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setMeasuredWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // === Dynamic column count — once the panel is resized wide enough
  // to fit another comfortable card tile per row, add one, instead of
  // staying locked at 2 columns regardless of how wide it gets.
  // Mirrors the panel's own body padding (space-4 each side) and grid
  // gap (space-2) so the math matches what's actually rendered.
  // === Column sizing — NOT 1fr. Grid's `1fr` tracks round each
  // column to a whole pixel independently and dump whatever's left
  // over into the LAST track so the row still sums to the container's
  // exact width — for most widths that's an invisible sub-pixel
  // rounding, but it can add up to several visible pixels, which is
  // exactly what made the last card in a row consistently render
  // wider than the others. Computing one exact pixel width here and
  // repeating that SAME number for every column removes any
  // possibility of that: every column is bit-for-bit identical,
  // and any leftover remainder just becomes a sliver of unused space
  // at the row's right edge instead of stretching a card.
  const GRID_GAP        = 8;  // matches --space-2
  const BODY_PADDING_X  = 32; // matches --space-4 on each side of .add-cards-panel-body
  const MIN_TILE_WIDTH  = 130;

  const availableWidth = measuredWidth - BODY_PADDING_X;
  const gridColumns = Math.max(
    2,
    Math.floor((availableWidth + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP))
  );
  const tileWidth = Math.floor((availableWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);

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
      if (cd.isDecluttered) return false;
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

  // === CHANGED: this used to hide a collection's pill entirely once
  // every one of its cards already had a spot in THIS binder (owned
  // ones placed, unowned ones already sitting there as grey
  // placeholders) — reasonable in theory, but confusing in practice:
  // a collection's pill would just silently vanish with no
  // explanation. Always showing every collection is more predictable;
  // if a collection genuinely has nothing left, selecting it just
  // shows an empty grid, which is a much clearer signal than a pill
  // that's simply not there.

  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      cardDefId:    card.id,
      collectionId: card.collectionId,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const inlineStyle = {
    ...(position ? { left: position.x, top: position.y, right: 'auto' } : null),
    ...(size ? { width: size.width, height: size.height } : null),
  };

  return (
    <div
      ref={panelRef}
      className={`add-cards-panel ${isDragging ? 'add-cards-panel-dragging' : ''} ${isResizing ? 'add-cards-panel-resizing' : ''}`}
      role="complementary"
      aria-label="Add cards to binder"
      style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
    >
      <div
        className="add-cards-panel-drag-handle"
        onMouseDown={handleDragHandlePointerDown}
        onTouchStart={handleDragHandlePointerDown}
        title="Drag to move this panel"
      >
        <span className="add-cards-panel-drag-grip" aria-hidden="true">⠿</span>
      </div>

      {/* === Resize handles — right/bottom edges resize one dimension,
          the corner resizes both at once. Hidden on mobile (see CSS),
          where the panel is a fixed-size bottom sheet. === */}
      <div
        className="add-cards-panel-resize-handle add-cards-panel-resize-right"
        onMouseDown={(e) => startResize(e, 'width')}
        onTouchStart={(e) => startResize(e, 'width')}
        title="Drag to resize width"
      />
      <div
        className="add-cards-panel-resize-handle add-cards-panel-resize-bottom"
        onMouseDown={(e) => startResize(e, 'height')}
        onTouchStart={(e) => startResize(e, 'height')}
        title="Drag to resize height"
      />
      <div
        className="add-cards-panel-resize-handle add-cards-panel-resize-corner"
        onMouseDown={(e) => startResize(e, 'both')}
        onTouchStart={(e) => startResize(e, 'both')}
        title="Drag to resize"
      />

      <div className="add-cards-panel-header">
        <div>
          <h2 className="add-cards-panel-title">Add Cards</h2>
          <p className="add-cards-panel-subtitle">Drag a card onto any empty slot</p>
        </div>
        <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
      </div>

      {collections.length > 1 && (
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
          {collections.map(c => (
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
            <div
              className="card-grid add-cards-panel-grid"
              style={{ gridTemplateColumns: `repeat(${gridColumns}, ${tileWidth}px)` }}
            >
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