/**
 * @fileoverview CustomizeCoverModal — upload, position, and rotate
 * stickers on a binder's cover.
 * === ISSUE #92: Binder close/open animation with sticker customisation ===
 *
 * Opens from a hover-revealed button on the closed cover (both in the
 * binders grid and BinderView's closed-cover state). Stickers are
 * uploaded images (compressed via compressImage, same utility as card
 * images), freely draggable via useDraggable, and rotatable via a
 * handle once selected.
 *
 * Local editing state only — nothing is dispatched to the store until
 * Save is clicked, matching the pattern other modals in this app use
 * (CreateCollectionModal stages changes locally until the final step).
 */

import { useState, useRef, useCallback } from 'react';
import { Modal, ModalActions, Button } from '../ui/index.jsx';
import { createSticker } from '../../types/index.js';
import { compressStickerImage } from '../../utils/index.js';
import { useDraggable } from '../../hooks/useDraggable.js';

const STICKER_MAX_WIDTH = 400; // raised from 200 — stickers can now be resized up to ~8x via the geometric clamp (centered stickers), and 200px source looked blurry when scaled that far up. Cards already use 600px via the same base64 storage pattern with no issues, so this is a safe middle ground.
const MAX_STICKERS = 10;

export function CustomizeCoverModal({ binder, color, onSubmit, onClose }) {
  const [stickers, setStickers] = useState(binder.stickers ?? []);
  const [selectedId, setSelectedId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const coverRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleAddStickerClick = () => {
    if (stickers.length >= MAX_STICKERS) {
      setUploadError(`Maximum ${MAX_STICKERS} stickers per cover.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const isUploadingRef = useRef(false);

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    // === DEBUG/FIX: guards against this handler somehow running twice
    // for a single file selection (observed: one upload produced two
    // fully-overlapping stickers with identical x/y/rotation). Using a
    // ref (not state) so the guard is checked synchronously before any
    // state update or re-render can occur.
    if (isUploadingRef.current) {
      console.log('[DEBUG] handleFileSelected called again while already uploading — ignoring duplicate call');
      return;
    }
    isUploadingRef.current = true;

    setIsUploading(true);
    setUploadError('');
    try {
      const image_url = await compressStickerImage(file, STICKER_MAX_WIDTH);
      const { sticker, errors } = createSticker({ image_url, x: 50, y: 50, rotation: 0 });
      if (!sticker) {
        setUploadError('Could not add that image — ' + errors.join(', '));
        return;
      }
      setStickers(prev => [...prev, sticker]);
      setSelectedId(sticker.id);
    } catch (err) {
      setUploadError('Could not read that image. Try a different file.');
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  const handleRemoveSticker = (id) => {
    setStickers(prev => prev.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSticker = useCallback((id, patch) => {
    setStickers(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const handleSave = () => {
    onSubmit({ ...binder, stickers, updatedAt: Date.now() });
  };

  return (
    <Modal title={`Customize Cover — ${binder.name}`} onClose={onClose} size="lg">
      <p className="modal-step-intro">
        Upload images and drag them onto the cover. Click a sticker to select it, then drag
        the handle to rotate it.
      </p>

      {/* === ISSUE #92 FIX: canvas aspect ratio now computed from the
          binder's own rows/cols, matching the real cover's proportions
          (which emerge from the page's slot grid) instead of a fixed
          2.5:3.5 card ratio that was completely unrelated to the
          binder's actual shape — a 3x3 binder and a 2x6 binder looked
          identical here before, when their real covers don't. === */}
      <div
        ref={coverRef}
        className="cover-customizer-canvas"
        style={{
          background: `linear-gradient(135deg, ${color}dd 0%, ${color} 50%, ${color}bb 100%)`,
          aspectRatio: `${binder.cols * 2.5} / ${binder.rows * 3.5}`,
        }}
        onMouseDown={() => setSelectedId(null)}
      >
        <div className="binder-cover-content">
          <div className="binder-cover-name">{binder.name}</div>
          <div className="binder-cover-meta">{binder.pages} pages · {binder.rows}×{binder.cols}</div>
        </div>

        {stickers.map(sticker => (
          <CustomizerSticker
            key={sticker.id}
            sticker={sticker}
            containerRef={coverRef}
            isSelected={selectedId === sticker.id}
            onSelect={() => setSelectedId(sticker.id)}
            onChange={(patch) => updateSticker(sticker.id, patch)}
            onRemove={() => handleRemoveSticker(sticker.id)}
          />
        ))}
      </div>

      {uploadError && <p className="field-error-msg">{uploadError}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <ModalActions>
        <Button variant="ghost" onClick={handleAddStickerClick} disabled={isUploading || stickers.length >= MAX_STICKERS}>
          {isUploading ? 'Adding…' : `+ Add Sticker (${stickers.length}/${MAX_STICKERS})`}
        </Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save Cover</Button>
      </ModalActions>
    </Modal>
  );
}

/**
 * A single sticker within the customizer canvas — wraps useDraggable to
 * handle its own position/rotation dragging independently.
 */
const STICKER_BASE_SIZE = 56; // px — matches .cover-customizer-sticker's width/height

function CustomizerSticker({ sticker, containerRef, isSelected, onSelect, onChange, onRemove }) {
  // === ISSUE #92: max scale is GEOMETRIC, computed from the sticker's
  // current position — a sticker centered in the middle of the cover
  // can grow much larger before clipping an edge than one sitting near
  // a corner. Recomputed on every render (cheap: a few arithmetic ops,
  // no layout thrashing) so it always reflects the sticker's current
  // x/y, including while actively dragging it to a new spot. ===
  const dynamicMaxScale = (() => {
    const container = containerRef.current;
    if (!container) return 3; // fallback before first layout
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 3;

    // Distance from the sticker's center to each edge, in px.
    const centerXPx = (sticker.x / 100) * rect.width;
    const centerYPx = (sticker.y / 100) * rect.height;
    const distToNearestEdgeX = Math.min(centerXPx, rect.width - centerXPx);
    const distToNearestEdgeY = Math.min(centerYPx, rect.height - centerYPx);
    const distToNearestEdge = Math.min(distToNearestEdgeX, distToNearestEdgeY);

    // The sticker's half-size at scale=1 is STICKER_BASE_SIZE/2 — the
    // max scale is however many of those half-sizes fit in the distance
    // to the nearest edge.
    const maxScale = distToNearestEdge / (STICKER_BASE_SIZE / 2);
    // Still respect a sensible floor so it never computes to something
    // smaller than the existing min bound.
    return Math.max(0.4, maxScale);
  })();

  const { dragHandlers, rotateHandlers, resizeHandlers, isDragging } = useDraggable({
    containerRef,
    position: { x: sticker.x, y: sticker.y },
    rotation: sticker.rotation,
    scale: sticker.scale ?? 1,
    scaleBounds: { min: 0.4, max: dynamicMaxScale },
    onPositionChange: (x, y) => onChange({ x, y }),
    onRotationChange: (rotation) => onChange({ rotation }),
    onScaleChange: (scale) => onChange({ scale }),
  });

  return (
    <div
      className={`cover-customizer-sticker ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale ?? 1})`,
      }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(); dragHandlers.onMouseDown(e); }}
      onTouchStart={(e) => { e.stopPropagation(); onSelect(); dragHandlers.onTouchStart(e); }}
    >
      <img src={sticker.image_url} alt="" draggable={false} />

      {isSelected && (
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