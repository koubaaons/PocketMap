// @vitest-environment jsdom
/**
 * @fileoverview Tests for useOwnershipEditor.js.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOwnershipEditor } from '../useOwnershipEditor.js';

describe('useOwnershipEditor', () => {
  it('starts with no card being viewed', () => {
    const { result } = renderHook(() => useOwnershipEditor());
    expect(result.current.viewingCard).toBe(null);
  });

  it('openDetail sets the viewing card', () => {
    const { result } = renderHook(() => useOwnershipEditor());
    const card = { id: 'card-1', name: 'Pikachu' };
    act(() => result.current.openDetail(card));
    expect(result.current.viewingCard).toBe(card);
  });

  it('closeDetail clears the viewing card', () => {
    const { result } = renderHook(() => useOwnershipEditor());
    act(() => result.current.openDetail({ id: 'card-1' }));
    act(() => result.current.closeDetail());
    expect(result.current.viewingCard).toBe(null);
  });
});
