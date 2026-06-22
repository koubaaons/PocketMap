/**
 * @fileoverview CustomizerSticker — a single sticker on a binder cover,
 * draggable/rotatable/resizable via useDraggable.
 *
 * This is the EXACT same component that lived inside CustomizeCoverModal.jsx
 * — moved into its own file, with zero changes to its core logic, so it
 * can be rendered directly on the real binder cover (no modal/popup) as
 * well as anywhere else that still wants it. If something ever behaves
 * differently here than it did in the modal, it is NOT this file —
 * check the container it's being rendered into instead.
 *
 * === Sizing/positioning limits (per explicit user request) ===
 * NO geometric containment calculation of any kind. Position is
 * clamped only to the plain 0-100% range (so the sticker's CENTER
 * point can't go negative or past 100%, which useDraggable already
 * does on its own). Scale is clamped only to a generous fixed ceiling
 * (MAX_SCALE below) — not derived from position, size, or rotation at
 * all. This means a large/centered sticker CAN visually extend past
 * the cover's edge if dragged or resized that far; that trade-off is
 * intentional and explicitly requested, in exchange for an editor that
 * never feels artificially restrictive.
 */

import { useState, useCallback } from 'react';
import { useDraggable } from '../../hooks/useDraggable.js';

const MAX_SCALE = 30;

export function CustomizerSticker({ sticker, containerRef, isSelected = false, onSelect, onChange, onRemove, editable = true }) {
  // === Aspect ratio: the box matches the source image's real
  // proportions instead of being forced square, so the visible artwork
  // and the draggable/resizable box are the same shape. Defaults to 1
  // (square) until the image has loaded.
  const [aspectRatio, setAspectRatio] = useState(1);
  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
  }, []);

  const { dragHandlers, rotateHandlers, resizeHandlers, isDragging } = useDraggable({
    containerRef,
    position: { x: sticker.x, y: sticker.y },
    rotation: sticker.rotation,
    scale: sticker.scale ?? 1,
    scaleBounds: { min: 0.4, max: MAX_SCALE },
    disabled: !editable,
    onPositionChange: (x, y) => onChange({ x, y }),
    onRotationChange: (rotation) => onChange({ rotation }),
    onScaleChange: (scale) => onChange({ scale }),
  });

  return (
    <div
      className={`cover-customizer-sticker ${editable && isSelected ? 'is-selected' : ''} ${editable && isDragging ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        width: `${sticker.size ?? 17.5}%`,
        aspectRatio: `${aspectRatio}`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale ?? 1})`,
        pointerEvents: editable ? 'auto' : 'none',
      }}
      onMouseDown={editable ? (e) => { e.stopPropagation(); onSelect(); dragHandlers.onMouseDown(e); } : undefined}
      onTouchStart={editable ? (e) => { e.stopPropagation(); onSelect(); dragHandlers.onTouchStart(e); } : undefined}
    >
      <img src={sticker.image_url} alt="" draggable={false} onLoad={handleImageLoad} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

      {editable && isSelected && (
        <>
          <button
            className="cover-customizer-sticker-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remove sticker"
            type="button"
          >
            ✕
          </button>
          <div
            className="cover-customizer-sticker-rotate-handle"
            onMouseDown={rotateHandlers.onMouseDown}
            onTouchStart={rotateHandlers.onTouchStart}
            aria-label="Rotate sticker"
          />
          <div
            className="cover-customizer-sticker-resize-handle"
            onMouseDown={resizeHandlers.onMouseDown}
            onTouchStart={resizeHandlers.onTouchStart}
            aria-label="Resize sticker"
          />
        </>
      )}
    </div>
  );
}