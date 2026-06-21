/**
 * @fileoverview useDraggable — generic drag-to-position hook.
 * === ISSUE #92: Binder close/open animation with sticker customisation ===
 *
 * Reusable, no sticker-specific logic at all — takes a container ref
 * (the bounding box dragging happens within) and the item's current
 * position, returns handlers to wire onto the draggable element plus a
 * live position during drag. Position is always expressed as PERCENTAGES
 * (0-100) of the container's own width/height, not raw pixels — this is
 * what keeps a dragged item's position correct regardless of how large
 * the container renders on different screens/zoom levels (the same
 * reasoning already used for sticker x/y in binder.types.js).
 *
 * Two independent pieces, both optional:
 *   - Position dragging: drag the item itself to move it.
 *   - Rotation dragging: drag a separate "handle" element to rotate the
 *     item around its own center, independent of position.
 *
 * Usage:
 *   const containerRef = useRef(null);
 *   const { dragHandlers, rotateHandlers, isDragging } = useDraggable({
 *     containerRef,
 *     position: { x: sticker.x, y: sticker.y },
 *     rotation: sticker.rotation,
 *     onPositionChange: (x, y) => updateSticker(sticker.id, { x, y }),
 *     onRotationChange: (rotation) => updateSticker(sticker.id, { rotation }),
 *   });
 *   <div ref={containerRef}>
 *     <div {...dragHandlers} style={{ left: `${sticker.x}%`, top: `${sticker.y}%` }}>
 *       <div {...rotateHandlers} className="rotate-handle" />
 *     </div>
 *   </div>
 */

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * @param {{
 *   containerRef: React.RefObject<HTMLElement>,
 *   position: { x: number, y: number },
 *   rotation?: number,
 *   scale?: number,
 *   onPositionChange?: (x: number, y: number) => void,
 *   onRotationChange?: (rotation: number) => void,
 *   onScaleChange?: (scale: number) => void,
 *   scaleBounds?: { min: number, max: number },
 *   disabled?: boolean,
 * }} params
 */
export function useDraggable({
  containerRef,
  position,
  rotation = 0,
  scale = 1,
  onPositionChange,
  onRotationChange,
  onScaleChange,
  scaleBounds = { min: 0.4, max: 3 },
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Refs (not state) for in-flight drag math — avoids re-render churn on
  // every mousemove; only onPositionChange/onRotationChange/onScaleChange
  // calls cause the actual sticker data to update, which the parent
  // re-renders from.
  const dragState = useRef(null);
  const rotateState = useRef(null);
  const resizeState = useRef(null);

  const clampPercent = (n) => Math.max(0, Math.min(100, n));
  const clampScale = (n) => Math.max(scaleBounds.min, Math.min(scaleBounds.max, n));

  // ── Position dragging ────────────────────────────────────────────────────

  const handlePositionPointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragState.current = {
      rect,
      startX: e.clientX,
      startY: e.clientY,
      startPctX: position.x,
      startPctY: position.y,
    };
    setIsDragging(true);
  }, [containerRef, position.x, position.y, disabled]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const state = dragState.current;
      if (!state) return;
      const { rect, startX, startY, startPctX, startPctY } = state;
      const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - startY) / rect.height) * 100;
      const nextX = clampPercent(startPctX + deltaXPct);
      const nextY = clampPercent(startPctY + deltaYPct);
      onPositionChange?.(nextX, nextY);
    };

    const handleUp = () => {
      setIsDragging(false);
      dragState.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, onPositionChange]);

  // ── Rotation dragging (separate handle, drags around the item's own
  //    center rather than the container) ──────────────────────────────────

  const handleRotatePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    // The rotate handle's own parent (the sticker element) is what we
    // rotate around the center of — find it via currentTarget's
    // offsetParent, which is the sticker wrapper in normal usage.
    const stickerEl = e.currentTarget.offsetParent;
    if (!stickerEl) return;
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    rotateState.current = { centerX, centerY, startAngle, startRotation: rotation };
    setIsRotating(true);
  }, [rotation, disabled]);

  useEffect(() => {
    if (!isRotating) return;

    const handleMove = (e) => {
      const state = rotateState.current;
      if (!state) return;
      const { centerX, centerY, startAngle, startRotation } = state;
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const delta = currentAngle - startAngle;
      onRotationChange?.(startRotation + delta);
    };

    const handleUp = () => {
      setIsRotating(false);
      rotateState.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isRotating, onRotationChange]);

  // ── Resize dragging (separate handle, distance-from-center maps to
  //    scale rather than position) ────────────────────────────────────────

  const handleResizePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const stickerEl = e.currentTarget.offsetParent;
    if (!stickerEl) return;
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startDistance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    resizeState.current = { centerX, centerY, startDistance, startScale: scale };
    setIsResizing(true);
  }, [scale, disabled]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e) => {
      const state = resizeState.current;
      if (!state) return;
      const { centerX, centerY, startDistance, startScale } = state;
      const currentDistance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      // Avoid division by zero if the pointer starts exactly on center
      // (shouldn't normally happen since the handle sits at the corner,
      // but guards against a stuck/NaN scale either way).
      const ratio = startDistance > 0 ? currentDistance / startDistance : 1;
      onScaleChange?.(clampScale(startScale * ratio));
    };

    const handleUp = () => {
      setIsResizing(false);
      resizeState.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isResizing, onScaleChange]);

  return {
    isDragging,
    isRotating,
    isResizing,
    dragHandlers: {
      onMouseDown: handlePositionPointerDown,
      onTouchStart: handlePositionPointerDown,
    },
    rotateHandlers: {
      onMouseDown: handleRotatePointerDown,
      onTouchStart: handleRotatePointerDown,
    },
    resizeHandlers: {
      onMouseDown: handleResizePointerDown,
      onTouchStart: handleResizePointerDown,
    },
  };
}