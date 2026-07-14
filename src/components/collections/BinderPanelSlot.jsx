/**
 * @fileoverview BinderPanelSlot — one combined-slot group (Michi Method).
 * Renders in place of what would otherwise be multiple individual
 * BinderSlot cells, spanning the grid via explicit grid-column/row
 * start+span (not CSS auto-placement — see BinderPage.jsx for why
 * explicit positioning is used for every cell, panel or not).
 *
 * Two panelType variants:
 *   'card'   — a real, ownable card that just needs more than one
 *              slot's worth of space (e.g. a Jumbo/oversized promo).
 *              Uses cardDef directly, same ownership/holo rendering
 *              as a normal BinderSlot.
 *   'insert' — a decorative image, not a card at all. No ownership,
 *              no holo effect, no rarity — just a name and an image.
 *
 * === Image positioning === The image is NOT force-cropped to fill
 * the combined space (that was the original version — object-fit:
 * cover with no user control). It's drag/resizable within the full
 * combined area (card-sized cells PLUS the gap between them, not just
 * one cell's worth), reusing useDraggable — the exact same hook
 * CustomizerSticker.jsx already uses for cover stickers, not
 * reimplemented. Position/scale are saved on the panel itself
 * (imageX/imageY/imageScale) via BINDER_PANEL_UPDATE once "Done" is
 * clicked; adjusting is off by default so normal browsing/clicking
 * still opens the card detail or does nothing (insert), same as
 * before.
 */

import { useState, useCallback, useRef } from 'react';
import { useDraggable } from '../../hooks/useDraggable.js';

const MAX_IMAGE_SCALE = 6;

export function BinderPanelSlot({
  panel,
  cardDef,
  insert,
  isOwned,
  gridColumnStart,
  gridRowStart,
  onClick,
  onUncombine,
  onUpdatePosition,
}) {
  const isCardPanel = panel.panelType === 'card';
  const name      = isCardPanel ? cardDef?.name : insert?.name;
  const imageUrl  = isCardPanel ? cardDef?.image_url : insert?.image_url;
  const showGrey  = isCardPanel && !isOwned;

  const [isAdjusting, setIsAdjusting] = useState(false);
  const containerRef = useRef(null);

  // Box matches the image's own real proportions (same reasoning as
  // CustomizerSticker.jsx) rather than being forced to the panel's
  // own aspect ratio, which is usually different from the image's.
  const [aspectRatio, setAspectRatio] = useState(1);
  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
  }, []);

  const imageX     = panel.imageX ?? 50;
  const imageY     = panel.imageY ?? 50;
  const imageScale = panel.imageScale ?? 1;

  // Same 2.5/3.5 card-proportion ratio every normal slot already uses
  // to derive its height from its width — scaled by the panel's own
  // span, so a 2x1 panel is exactly twice as wide as one card at the
  // same height, not "no ratio at all" (which was the actual bug —
  // removing the ratio entirely left the row's height undefined,
  // so it grew to fit content instead of matching the other rows).
  const panelAspectRatio = (2.5 * panel.spanCols) / (3.5 * panel.spanRows);

  const { dragHandlers, resizeHandlers, isDragging } = useDraggable({
    containerRef,
    position: { x: imageX, y: imageY },
    scale: imageScale,
    scaleBounds: { min: 0.2, max: MAX_IMAGE_SCALE },
    disabled: !isAdjusting,
    onPositionChange: (x, y) => onUpdatePosition({ imageX: x, imageY: y }),
    onScaleChange: (scale) => onUpdatePosition({ imageScale: scale }),
  });

  return (
    <div
      ref={containerRef}
      className={`binder-slot binder-panel-slot ${showGrey ? 'binder-slot-placeholder' : 'binder-slot-filled'} ${isAdjusting ? 'binder-panel-slot-adjusting' : ''}`}
      style={{
        gridColumnStart,
        gridRowStart,
        gridColumn: `span ${panel.spanCols}`,
        gridRow: `span ${panel.spanRows}`,
        aspectRatio: `${panelAspectRatio}`,
        cursor: isAdjusting ? 'default' : 'pointer',
      }}
      onClick={isAdjusting ? undefined : onClick}
      onKeyDown={(e) => { if (!isAdjusting && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      role={isAdjusting ? undefined : 'button'}
      tabIndex={isAdjusting ? undefined : 0}
      aria-label={name ? `${name} (combined slot, ${panel.spanCols}x${panel.spanRows})` : 'Combined slot'}
    >
      <span className="binder-panel-slot-badge">
        {panel.spanCols}×{panel.spanRows}
      </span>

      {imageUrl ? (
        <div
          className={`binder-panel-image-wrap ${isDragging ? 'is-dragging' : ''}`}
          style={{
            position: 'absolute',
            left: `${imageX}%`,
            top: `${imageY}%`,
            height: '100%',
            aspectRatio: `${aspectRatio}`,
            transform: `translate(-50%, -50%) scale(${imageScale})`,
            pointerEvents: isAdjusting ? 'auto' : 'none',
          }}
          onMouseDown={isAdjusting ? dragHandlers.onMouseDown : undefined}
          onTouchStart={isAdjusting ? dragHandlers.onTouchStart : undefined}
        >
          <img
            src={imageUrl}
            alt={name ?? 'Combined slot'}
            draggable={false}
            onLoad={handleImageLoad}
            className={showGrey ? 'slot-card-image-grey' : ''}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {isAdjusting && (
            <div
              className="binder-panel-image-resize-handle"
              onMouseDown={resizeHandlers.onMouseDown}
              onTouchStart={resizeHandlers.onTouchStart}
              aria-label="Resize image"
            />
          )}
        </div>
      ) : (
        <div className="slot-card-content">
          <span className="slot-card-name">{name ?? 'Empty combined slot'}</span>
          {!imageUrl && <span className="slot-placeholder-label">Click to add an image</span>}
        </div>
      )}

      {imageUrl && !isAdjusting && (
        <button
          className="binder-panel-adjust-btn"
          onClick={(e) => { e.stopPropagation(); setIsAdjusting(true); }}
          aria-label="Adjust image position and size"
          title="Adjust image"
        >
          ⤢
        </button>
      )}

      {isAdjusting && (
        <button
          className="binder-panel-adjust-done-btn"
          onClick={(e) => { e.stopPropagation(); setIsAdjusting(false); }}
        >
          Done
        </button>
      )}

      {onUncombine && !isAdjusting && (
        <button
          className="binder-slot-remove binder-panel-uncombine"
          onClick={(e) => { e.stopPropagation(); onUncombine(); }}
          aria-label="Uncombine these slots"
          title="Uncombine"
        >
          ✕
        </button>
      )}
    </div>
  );
}