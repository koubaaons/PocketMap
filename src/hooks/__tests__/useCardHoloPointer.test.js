// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardHoloPointer.js.
 *
 * This hook writes CSS custom properties directly to the DOM rather
 * than through React state, so these tests render the hook, attach a
 * real element via holoRef, and check el.style.getPropertyValue(...)
 * after simulating pointer events.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardHoloPointer } from '../useCardHoloPointer.js';

function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, ...rect });
}

describe('useCardHoloPointer — handlePointerMove', () => {
  it('sets --pointer-x/--pointer-y as percentages of the element size', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: 25, clientY: 75 }));

    expect(el.style.getPropertyValue('--pointer-x')).toBe('25%');
    expect(el.style.getPropertyValue('--pointer-y')).toBe('75%');
  });

  it('sets --pointer-from-center to 0 exactly at the center', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: 50, clientY: 50 }));

    expect(el.style.getPropertyValue('--pointer-from-center')).toBe('0.0000');
  });

  it('sets --pointer-from-center close to 1 near a corner', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: 0, clientY: 0 })); // top-left corner

    expect(parseFloat(el.style.getPropertyValue('--pointer-from-center'))).toBeCloseTo(1, 1);
  });

  it('clamps position to 0-100% even if the pointer is reported outside the element bounds', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: -50, clientY: 500 }));

    expect(el.style.getPropertyValue('--pointer-x')).toBe('0%');
    expect(el.style.getPropertyValue('--pointer-y')).toBe('100%');
  });

  it('does nothing if no element has been attached via holoRef yet', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    // No holoRef call at all — should not throw
    expect(() => act(() => result.current.handlePointerMove({ clientX: 10, clientY: 10 }))).not.toThrow();
  });

  it('does nothing for a zero-size element (not yet laid out)', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 0, height: 0 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: 10, clientY: 10 }));

    expect(el.style.getPropertyValue('--pointer-x')).toBe(''); // never set
  });

  it('does NOT set --rotate-x/--rotate-y — binder slots must stay flat', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMove({ clientX: 90, clientY: 10 }));

    expect(el.style.getPropertyValue('--rotate-x')).toBe('');
    expect(el.style.getPropertyValue('--rotate-y')).toBe('');
  });
});

describe('useCardHoloPointer — handlePointerMoveWithTilt', () => {
  it('sets --rotate-x/--rotate-y in addition to the base pointer properties', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMoveWithTilt({ clientX: 50, clientY: 50 }));

    expect(el.style.getPropertyValue('--rotate-x')).toBe('0.00deg');
    expect(el.style.getPropertyValue('--rotate-y')).toBe('0.00deg');
  });

  it('tilts toward the pointer — moving right produces a nonzero rotateY', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));

    act(() => result.current.handlePointerMoveWithTilt({ clientX: 100, clientY: 50 }));

    expect(parseFloat(el.style.getPropertyValue('--rotate-y'))).toBeCloseTo(12, 1); // MAX_TILT_DEG
  });
});

describe('useCardHoloPointer — pointer leave', () => {
  it('handlePointerLeave resets position to 50/50 center and from-center to 0', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));
    act(() => result.current.handlePointerMove({ clientX: 90, clientY: 10 }));

    act(() => result.current.handlePointerLeave());

    expect(el.style.getPropertyValue('--pointer-x')).toBe('50%');
    expect(el.style.getPropertyValue('--pointer-y')).toBe('50%');
    expect(el.style.getPropertyValue('--pointer-from-center')).toBe('0');
  });

  it('handlePointerLeaveWithTilt also zeroes the rotation back to flat', () => {
    const { result } = renderHook(() => useCardHoloPointer());
    const el = document.createElement('div');
    stubRect(el, { left: 0, top: 0, width: 100, height: 100 });
    act(() => result.current.holoRef(el));
    act(() => result.current.handlePointerMoveWithTilt({ clientX: 90, clientY: 10 }));

    act(() => result.current.handlePointerLeaveWithTilt());

    expect(el.style.getPropertyValue('--rotate-x')).toBe('0deg');
    expect(el.style.getPropertyValue('--rotate-y')).toBe('0deg');
    expect(el.style.getPropertyValue('--pointer-x')).toBe('50%'); // base reset too
  });
});
