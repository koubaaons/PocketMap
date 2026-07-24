// @vitest-environment jsdom
/**
 * @fileoverview Tests for useAcquisitionForm.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAcquisitionForm } from '../useAcquisitionForm.js';

describe('useAcquisitionForm', () => {
  it('builds initial fields from the given inventory item', () => {
    const item = { condition_rating: 'Near Mint', language: 'English', label: 'Alt art', personal_notes: 'Bought at a show', is_tradeable: true, is_sellable: false };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit: vi.fn() }));

    expect(result.current.fields).toMatchObject({
      condition_rating: 'Near Mint', language: 'English', label: 'Alt art',
      personal_notes: 'Bought at a show', is_tradeable: true, is_sellable: false,
    });
  });

  it('falls back to empty/false defaults for a null inventoryItem (unowned card)', () => {
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: null, onSubmit: vi.fn() }));

    expect(result.current.fields).toEqual({
      condition_rating: '', language: '', label: '', personal_notes: '',
      is_tradeable: false, is_sellable: false, acquired_at: '',
    });
  });

  it('formats a valid acquired_at timestamp as a YYYY-MM-DD date string', () => {
    const item = { acquired_at: new Date('2024-03-15T12:00:00Z').getTime() };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit: vi.fn() }));

    expect(result.current.fields.acquired_at).toBe('2024-03-15');
  });

  it('falls back to an empty acquired_at when the stored value is not a valid date', () => {
    const item = { acquired_at: 'not-a-real-date' };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit: vi.fn() }));

    expect(result.current.fields.acquired_at).toBe('');
  });

  it('set() updates exactly one field, leaving the rest untouched', () => {
    const item = { condition_rating: 'Near Mint', language: 'English' };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit: vi.fn() }));

    act(() => result.current.set('language', 'Japanese'));

    expect(result.current.fields.language).toBe('Japanese');
    expect(result.current.fields.condition_rating).toBe('Near Mint');
  });

  it('reset() restores the fields back to the real current inventory item values', () => {
    const item = { language: 'English' };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit: vi.fn() }));

    act(() => result.current.set('language', 'Draft change'));
    act(() => result.current.reset());

    expect(result.current.fields.language).toBe('English');
  });

  it('handleSubmit calls onSubmit with the inventory item spread, plus the edited fields and a fresh updatedAt', () => {
    const onSubmit = vi.fn();
    const item = { id: 'inv-1', cardDefId: 'card-1' };
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: item, onSubmit }));

    act(() => result.current.set('condition_rating', 'Lightly Played'));
    act(() => result.current.set('label', '  Alt art copy  ')); // check trimming too
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.id).toBe('inv-1'); // spread from the original item
    expect(submitted.condition_rating).toBe('Lightly Played');
    expect(submitted.label).toBe('Alt art copy'); // trimmed
    expect(typeof submitted.updatedAt).toBe('number');
  });

  it('handleSubmit converts blank string fields to null, not empty strings', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: {}, onSubmit }));

    act(() => result.current.handleSubmit());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.condition_rating).toBe(null);
    expect(submitted.language).toBe(null);
    expect(submitted.label).toBe(null);
    expect(submitted.personal_notes).toBe(null);
    expect(submitted.acquired_at).toBe(null);
  });

  it('handleSubmit converts a valid acquired_at date string to a timestamp', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useAcquisitionForm({ inventoryItem: {}, onSubmit }));

    act(() => result.current.set('acquired_at', '2024-06-01'));
    act(() => result.current.handleSubmit());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.acquired_at).toBe(new Date('2024-06-01').getTime());
  });
});
