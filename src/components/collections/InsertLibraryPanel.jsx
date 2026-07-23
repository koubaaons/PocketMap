/**
 * @fileoverview InsertLibraryPanel — persistent, draggable/resizable
 * image picker for filling combined binder slots (Michi Method).
 *
 * Same interaction model as AddCardsPanel.jsx (drag position/resize
 * logic is deliberately identical — copied rather than abstracted
 * into a shared base, since AddCardsPanel already went through many
 * rounds of real bug fixes for this exact positioning/sizing logic,
 * and duplicating a proven, working implementation here is safer
 * than risking new bugs from a hasty abstraction under time pressure):
 * stays open across multiple placements, drag a tile from here onto
 * any blank insert-type panel in the binder, keep going, "Done" is
 * the only thing that closes it.
 *
 * Only ever rendered while Combine Mode is active (see BinderView.jsx)
 * — outside combine mode there's no such thing as a "blank combined
 * panel" to drop an image onto, so the panel has no reason to exist
 * there.
 *
 * Managing the library itself (deleting images, browsing without a
 * binder open) lives in LibraryView.jsx, the sidebar's "Library"
 * page — this component is only for using the library, not curating
 * it, though it does offer the same batch upload for convenience.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useBinderInsertActions } from '../../hooks/useBinderInsertActions.js';

export function InsertLibraryPanel({ binderInserts, toast, onClose }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { handleBulkAddInserts } = useBinderInsertActions(toast, user?.id);

  // === Panel dragging — identical approach to AddCardsPanel.jsx;
  // see that file's own header comment for the full reasoning.
  const panelRef = useRef(null);
  const dragState = useRef(null);
  const [position, setPosition] = useState(null);
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
    if (window.innerWidth <= 768) return;
    if (!e.touches) e.preventDefault();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const coords = getPointerCoords(e);
    dragState.current = { offsetX: coords.x - rect.left, offsetY: coords.y - rect.top };
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
    const handleUp = () => { setIsDragging(false); dragState.current = null; };
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

  useEffect(() => {
    if (!position) return;
    const handleResize = () => setPosition(p => p ? clampPosition(p.x, p.y) : p);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // === Panel resizing — identical approach to AddCardsPanel.jsx.
  const MIN_WIDTH  = 320;
  const MIN_HEIGHT = 280;
  const resizeState = useRef(null);
  const [size, setSize] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  const maxWidth  = () => Math.min(900, window.innerWidth * 0.9);
  const maxHeight = () => window.innerHeight - 16;

  const clampSize = useCallback((width, height) => ({
    width:  Math.min(Math.max(width,  MIN_WIDTH),  maxWidth()),
    height: Math.min(Math.max(height, MIN_HEIGHT), maxHeight()),
  }), []);

  const startResize = (e, axis) => {
    if (window.innerWidth <= 768) return;
    if (!e.touches) e.preventDefault();
    e.stopPropagation();
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!position) setPosition({ x: rect.left, y: rect.top });
    const coords = getPointerCoords(e);
    resizeState.current = { axis, startX: coords.x, startY: coords.y, startWidth: rect.width, startHeight: rect.height };
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
    const handleUp = () => { setIsResizing(false); resizeState.current = null; };
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
  }, [isResizing, clampSize]);

  useEffect(() => {
    if (!size) return;
    const handleWindowResize = () => setSize(s => s ? clampSize(s.width, s.height) : s);
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [size, clampSize]);

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

  const GRID_GAP        = 8;
  const BODY_PADDING_X  = 32;
  const MIN_TILE_WIDTH  = 130;
  const availableWidth  = measuredWidth - BODY_PADDING_X;
  const gridColumns = Math.max(2, Math.floor((availableWidth + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP)));
  const tileWidth   = Math.floor((availableWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return binderInserts;
    return binderInserts.filter(i => i.name.toLowerCase().includes(q));
  }, [binderInserts, query]);

  const handleDragStart = (e, insert) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ insertId: insert.id }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFilesSelected = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      await handleBulkAddInserts(files);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
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
      aria-label="Image library"
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

      <div className="add-cards-panel-resize-handle add-cards-panel-resize-right" onMouseDown={(e) => startResize(e, 'width')} onTouchStart={(e) => startResize(e, 'width')} title="Drag to resize width" />
      <div className="add-cards-panel-resize-handle add-cards-panel-resize-bottom" onMouseDown={(e) => startResize(e, 'height')} onTouchStart={(e) => startResize(e, 'height')} title="Drag to resize height" />
      <div className="add-cards-panel-resize-handle add-cards-panel-resize-corner" onMouseDown={(e) => startResize(e, 'both')} onTouchStart={(e) => startResize(e, 'both')} title="Drag to resize" />

      <div className="add-cards-panel-header">
        <div>
          <h2 className="add-cards-panel-title">Image Library</h2>
          <p className="add-cards-panel-subtitle">Drag an image onto any blank combined slot</p>
        </div>
        <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
      </div>

      <div className="add-cards-panel-search" style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <div className="search-bar-wrapper" style={{ flex: 1 }}>
          <span className="search-icon">◎</span>
          <input
            className="search-input"
            placeholder="Search library…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search library images"
          />
          {query && <button className="search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? '…' : '+ Add'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesSelected}
        />
      </div>

      <div className="add-cards-panel-body">
        {filtered.length === 0 && (
          <p className="empty-results">
            {query ? `No images found for "${query}"` : 'Your library is empty — click "+ Add" to upload some images'}
          </p>
        )}

        {filtered.length > 0 && (
          <div
            className="card-grid add-cards-panel-grid"
            style={{ gridTemplateColumns: `repeat(${gridColumns}, ${tileWidth}px)` }}
          >
            {filtered.map(insert => (
              <div
                key={insert.id}
                className="card-grid-item add-cards-panel-tile"
                draggable
                onDragStart={(e) => handleDragStart(e, insert)}
                title={insert.name}
              >
                <div className="card-grid-item-image-wrapper">
                  <img
                    src={insert.image_url}
                    alt={insert.name}
                    className="card-grid-item-image"
                    draggable={false}
                  />
                </div>
                <div className="card-grid-item-info">
                  <span className="card-grid-item-name">{insert.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
