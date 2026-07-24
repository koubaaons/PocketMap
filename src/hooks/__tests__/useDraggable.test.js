// @vitest-environment jsdom
/**
 * @fileoverview Tests for useDraggable.js.
 *
 * This hook drives its actual position/rotation/scale updates through
 * window-level mousemove/mouseup listeners set up in an effect after
 * pointer-down, not through the pointer-down handler alone — so these
 * tests simulate the full sequence (call the pointer-down handler
 * directly with a constructed event, then dispatch real window
 * events) rather than only checking that a handler exists.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraggable } from '../useDraggable.js';

function makeContainerRef(rect = { left: 0, top: 0, width: 200, height: 200 }) {
  return { current: { getBoundingClientRect: () => rect } };
}

function fireWindow(type, opts) {
  window.dispatchEvent(new MouseEvent(type, opts));
}

function fakeEvent(overrides = {}) {
  return { preventDefault: () => {}, stopPropagation: () => {}, ...overrides };
}

describe('useDraggable — position dragging', () => {
  it('dragging moves the element by the same percentage the pointer moved, relative to the container', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef({ left: 0, top: 0, width: 200, height: 200 });
    const { result } = renderHook(() => useDraggable({
      containerRef, position: { x: 50, y: 50 }, onPositionChange,
    }));

    act(() => result.current.dragHandlers.onMouseDown(fakeEvent({ clientX: 10, clientY: 10 })));
    expect(result.current.isDragging).toBe(true);

    // Moved 20px right and down in a 200px container = 10% each way
    act(() => fireWindow('mousemove', { clientX: 30, clientY: 30 }));

    expect(onPositionChange).toHaveBeenCalledWith(60, 60);
  });

  it('clamps position to 0-100%, even if the pointer moves far outside the container', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef({ left: 0, top: 0, width: 200, height: 200 });
    const { result } = renderHook(() => useDraggable({
      containerRef, position: { x: 50, y: 50 }, onPositionChange,
    }));

    act(() => result.current.dragHandlers.onMouseDown(fakeEvent({ clientX: 0, clientY: 0 })));
    act(() => fireWindow('mousemove', { clientX: 10000, clientY: -10000 }));

    expect(onPositionChange).toHaveBeenCalledWith(100, 0);
  });

  it('mouseup ends the drag — isDragging goes false and further mousemove events no longer call onPositionChange', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef();
    const { result } = renderHook(() => useDraggable({
      containerRef, position: { x: 50, y: 50 }, onPositionChange,
    }));

    act(() => result.current.dragHandlers.onMouseDown(fakeEvent({ clientX: 0, clientY: 0 })));
    act(() => fireWindow('mouseup', {}));

    expect(result.current.isDragging).toBe(false);

    onPositionChange.mockClear();
    act(() => fireWindow('mousemove', { clientX: 50, clientY: 50 }));
    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it('starts from 50/50 (not NaN) when the given position is missing — a stale/malformed position must not silently freeze the drag', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef({ left: 0, top: 0, width: 200, height: 200 });
    const { result } = renderHook(() => useDraggable({
      containerRef, position: {}, onPositionChange, // no x/y at all
    }));

    act(() => result.current.dragHandlers.onMouseDown(fakeEvent({ clientX: 0, clientY: 0 })));
    act(() => fireWindow('mousemove', { clientX: 20, clientY: 0 })); // +10%

    expect(onPositionChange).toHaveBeenCalledWith(60, 50); // started from 50, not NaN
  });

  it('supports touch events for starting a drag, reading coordinates from e.touches', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef({ left: 0, top: 0, width: 200, height: 200 });
    const { result } = renderHook(() => useDraggable({
      containerRef, position: { x: 50, y: 50 }, onPositionChange,
    }));

    act(() => result.current.dragHandlers.onTouchStart(fakeEvent({ touches: [{ clientX: 0, clientY: 0 }] })));

    // jsdom has no real TouchEvent constructor — dispatch a plain
    // Event with .touches attached, matching what getClientCoords
    // actually reads.
    const evt = new Event('touchmove');
    evt.touches = [{ clientX: 20, clientY: 0 }];
    act(() => window.dispatchEvent(evt));

    expect(onPositionChange).toHaveBeenCalledWith(60, 50); // +20px of 200 = +10%
  });

  it('does nothing at all when disabled', () => {
    const onPositionChange = vi.fn();
    const containerRef = makeContainerRef();
    const { result } = renderHook(() => useDraggable({
      containerRef, position: { x: 50, y: 50 }, onPositionChange, disabled: true,
    }));

    act(() => result.current.dragHandlers.onMouseDown(fakeEvent({ clientX: 0, clientY: 0 })));
    expect(result.current.isDragging).toBe(false);
  });
});

describe('useDraggable — resize/scale', () => {
  it('scales up proportionally to how much farther the pointer moves from center', () => {
    const onScaleChange = vi.fn();
    const stickerEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const { result } = renderHook(() => useDraggable({
      containerRef: makeContainerRef(), position: { x: 50, y: 50 }, scale: 1, onScaleChange,
    }));

    // center is (50,50); start the pointer 50px away (distance 50)
    act(() => result.current.resizeHandlers.onMouseDown(
      fakeEvent({ clientX: 100, clientY: 50, currentTarget: { offsetParent: stickerEl } })
    ));
    // move to 100px away from center -> ratio 2x -> scale 1 * 2 = 2
    act(() => fireWindow('mousemove', { clientX: 150, clientY: 50 }));

    expect(onScaleChange).toHaveBeenCalledWith(2);
  });

  it('clamps scale to scaleBounds', () => {
    const onScaleChange = vi.fn();
    const stickerEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const { result } = renderHook(() => useDraggable({
      containerRef: makeContainerRef(), position: { x: 50, y: 50 }, scale: 1, onScaleChange,
      scaleBounds: { min: 0.5, max: 2.5 },
    }));

    act(() => result.current.resizeHandlers.onMouseDown(
      fakeEvent({ clientX: 100, clientY: 50, currentTarget: { offsetParent: stickerEl } })
    ));
    // move to 1000px away -> ratio 20x -> would be scale 20, clamped to max 2.5
    act(() => fireWindow('mousemove', { clientX: 1050, clientY: 50 }));

    expect(onScaleChange).toHaveBeenCalledWith(2.5);
  });
});

describe('useDraggable — rotation', () => {
  it('rotates by the angle the pointer moved around the center', () => {
    const onRotationChange = vi.fn();
    const stickerEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
    const { result } = renderHook(() => useDraggable({
      containerRef: makeContainerRef(), position: { x: 50, y: 50 }, rotation: 0, onRotationChange,
    }));

    // center is (50,50); start pointer directly to the right (angle 0deg)
    act(() => result.current.rotateHandlers.onMouseDown(
      fakeEvent({ clientX: 100, clientY: 50, currentTarget: { offsetParent: stickerEl } })
    ));
    // move pointer directly below center (angle 90deg) -> delta +90deg from start
    act(() => fireWindow('mousemove', { clientX: 50, clientY: 100 }));

    expect(onRotationChange).toHaveBeenCalledWith(90);
  });
});
