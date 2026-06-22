/**
 * @fileoverview useDraggable — generic drag-to-position hook.
 *
 * Reusable, no sticker-specific logic at all — takes a container ref
 * (the bounding box dragging happens within) and the item's current
 * position, returns handlers to wire onto the draggable element plus a
 * live position during drag. Position is always expressed as PERCENTAGES
 * (0-100) of the container's own width/height.
 *
 * Fixes included:
 * 1. Touch-event coordinates: TouchEvent has no clientX/clientY of its
 *    own (they live on e.touches[0]) — getClientCoords normalizes
 *    mouse and touch events so dragging works on both.
 * 2. NaN-safe starting position: if position.x/position.y is ever
 *    undefined/NaN (e.g. stale or malformed sticker data), the drag
 *    starts from 50/50 instead of silently propagating NaN through
 *    every subsequent calculation, which froze the element in place
 *    no matter how far the pointer moved.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

function getClientCoords(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function safePct(n) {
  return Number.isFinite(n) ? n : 50;
}

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
    const coords = getClientCoords(e);
    dragState.current = {
      rect,
      startX: coords.x,
      startY: coords.y,
      startPctX: safePct(position.x),
      startPctY: safePct(position.y),
    };
    setIsDragging(true);
  }, [containerRef, position.x, position.y, disabled]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const state = dragState.current;
      if (!state) return;
      const { rect, startX, startY, startPctX, startPctY } = state;
      const coords = getClientCoords(e);
      const deltaXPct = ((coords.x - startX) / rect.width) * 100;
      const deltaYPct = ((coords.y - startY) / rect.height) * 100;
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

  // ── Rotation dragging ────────────────────────────────────────────────────

  const handleRotatePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const stickerEl = e.currentTarget.offsetParent;
    if (!stickerEl) return;
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const coords = getClientCoords(e);
    const startAngle = Math.atan2(coords.y - centerY, coords.x - centerX) * (180 / Math.PI);
    rotateState.current = { centerX, centerY, startAngle, startRotation: Number.isFinite(rotation) ? rotation : 0 };
    setIsRotating(true);
  }, [rotation, disabled]);

  useEffect(() => {
    if (!isRotating) return;

    const handleMove = (e) => {
      const state = rotateState.current;
      if (!state) return;
      const { centerX, centerY, startAngle, startRotation } = state;
      const coords = getClientCoords(e);
      const currentAngle = Math.atan2(coords.y - centerY, coords.x - centerX) * (180 / Math.PI);
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

  // ── Resize dragging ──────────────────────────────────────────────────────

  const handleResizePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const stickerEl = e.currentTarget.offsetParent;
    if (!stickerEl) return;
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const coords = getClientCoords(e);
    const startDistance = Math.hypot(coords.x - centerX, coords.y - centerY);
    resizeState.current = { centerX, centerY, startDistance, startScale: Number.isFinite(scale) ? scale : 1 };
    setIsResizing(true);
  }, [scale, disabled]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e) => {
      const state = resizeState.current;
      if (!state) return;
      const { centerX, centerY, startDistance, startScale } = state;
      const coords = getClientCoords(e);
      const currentDistance = Math.hypot(coords.x - centerX, coords.y - centerY);
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