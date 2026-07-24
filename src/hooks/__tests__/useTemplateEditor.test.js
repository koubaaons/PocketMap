// @vitest-environment jsdom
/**
 * @fileoverview Tests for useTemplateEditor.js.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTemplateEditor } from '../useTemplateEditor.js';

describe('useTemplateEditor — initialization', () => {
  it('accepts a plain array of initial fields', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: 'Rarity', order: 0 }]));
    expect(result.current.fields).toHaveLength(1);
    expect(result.current.fields[0].field_name).toBe('Rarity');
  });

  it('accepts a factory function for initial fields — the fix that defers a non-deterministic Date.now()-based id to only run once', () => {
    const factory = () => [{ id: `new-${Date.now()}`, field_name: '', order: 0 }];
    const { result } = renderHook(() => useTemplateEditor(factory));
    expect(result.current.fields).toHaveLength(1);
  });

  it('defaults to an empty array when nothing is passed', () => {
    const { result } = renderHook(() => useTemplateEditor());
    expect(result.current.fields).toEqual([]);
  });

  it('starts with hasChanges false', () => {
    const { result } = renderHook(() => useTemplateEditor([]));
    expect(result.current.hasChanges).toBe(false);
  });
});

describe('useTemplateEditor — handleAdd', () => {
  it('appends a new blank field with a "new-" prefixed id and marks hasChanges', () => {
    const { result } = renderHook(() => useTemplateEditor([]));
    act(() => result.current.handleAdd());

    expect(result.current.fields).toHaveLength(1);
    expect(result.current.fields[0].id).toMatch(/^new-/);
    expect(result.current.fields[0].field_type).toBe('text');
    expect(result.current.hasChanges).toBe(true);
  });

  it('assigns the next order value based on current field count', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: 'X', order: 0 }]));
    act(() => result.current.handleAdd());
    expect(result.current.fields[1].order).toBe(1);
  });
});

describe('useTemplateEditor — handleChange', () => {
  it('updates the given key on the matching field only', () => {
    const { result } = renderHook(() => useTemplateEditor([
      { id: 'f1', field_name: 'A', order: 0 }, { id: 'f2', field_name: 'B', order: 1 },
    ]));
    act(() => result.current.handleChange('f1', 'field_name', 'Renamed'));

    expect(result.current.fields.find(f => f.id === 'f1').field_name).toBe('Renamed');
    expect(result.current.fields.find(f => f.id === 'f2').field_name).toBe('B');
  });

  it('clears any existing error for that field when changed', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: '', order: 0 }]));
    act(() => result.current.validate()); // sets an error for f1 (blank name)
    expect(result.current.errors.f1).toBeTruthy();

    act(() => result.current.handleChange('f1', 'field_name', 'Now Named'));
    expect(result.current.errors.f1).toBeUndefined();
  });
});

describe('useTemplateEditor — handleReorder', () => {
  it('moving a field "up" swaps its order with the previous one', () => {
    const { result } = renderHook(() => useTemplateEditor([
      { id: 'f1', field_name: 'A', order: 0 }, { id: 'f2', field_name: 'B', order: 1 },
    ]));
    act(() => result.current.handleReorder('f2', 'up'));

    expect(result.current.fields.map(f => f.id)).toEqual(['f2', 'f1']); // f2 now sorts first
  });

  it('moving the first field "up" does nothing (no field above it)', () => {
    const { result } = renderHook(() => useTemplateEditor([
      { id: 'f1', field_name: 'A', order: 0 }, { id: 'f2', field_name: 'B', order: 1 },
    ]));
    act(() => result.current.handleReorder('f1', 'up'));

    expect(result.current.fields.map(f => f.id)).toEqual(['f1', 'f2']); // unchanged
  });

  it('moving the last field "down" does nothing (no field below it)', () => {
    const { result } = renderHook(() => useTemplateEditor([
      { id: 'f1', field_name: 'A', order: 0 }, { id: 'f2', field_name: 'B', order: 1 },
    ]));
    act(() => result.current.handleReorder('f2', 'down'));

    expect(result.current.fields.map(f => f.id)).toEqual(['f1', 'f2']); // unchanged
  });
});

describe('useTemplateEditor — handleRemove', () => {
  it('removes a field whose id starts with "new-"', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'new-123', field_name: 'Draft', order: 0 }]));
    act(() => result.current.handleRemove('new-123'));
    expect(result.current.fields).toHaveLength(0);
  });

  it('refuses to remove a persisted field (a real, non-"new-" id) — safety guard against deleting saved schema', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'real-field-1', field_name: 'Rarity', order: 0 }]));
    act(() => result.current.handleRemove('real-field-1'));
    expect(result.current.fields).toHaveLength(1); // still there
  });
});

describe('useTemplateEditor — validate', () => {
  it('rejects a field with a blank name', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: '  ', order: 0, field_type: 'text' }]));
    act(() => result.current.validate());
    expect(result.current.errors.f1).toBe('Field name is required');
  });

  it('rejects a select field with no options', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: 'Rarity', order: 0, field_type: 'select', options: [] }]));
    act(() => result.current.validate());
    expect(result.current.errors.f1).toBe('Dropdown fields must have at least one option');
  });

  it('passes for a valid select field with at least one option', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: 'Rarity', order: 0, field_type: 'select', options: ['Common'] }]));
    let isValid;
    act(() => { isValid = result.current.validate(); });
    expect(isValid).toBe(true);
    expect(result.current.errors).toEqual({});
  });
});

describe('useTemplateEditor — reset and clearErrors', () => {
  it('reset() replaces the fields, clears errors, and clears hasChanges', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: 'A', order: 0 }]));
    act(() => result.current.handleAdd());
    act(() => result.current.validate());

    act(() => result.current.reset([{ id: 'f2', field_name: 'Fresh', order: 0 }]));

    expect(result.current.fields).toEqual([{ id: 'f2', field_name: 'Fresh', order: 0 }]);
    expect(result.current.errors).toEqual({});
    expect(result.current.hasChanges).toBe(false);
  });

  it('clearErrors() empties the errors object without touching fields', () => {
    const { result } = renderHook(() => useTemplateEditor([{ id: 'f1', field_name: '', order: 0 }]));
    act(() => result.current.validate());
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    act(() => result.current.clearErrors());
    expect(result.current.errors).toEqual({});
  });
});

describe('useTemplateEditor — sorted output', () => {
  it('always returns fields sorted by their order value, regardless of insertion order', () => {
    const { result } = renderHook(() => useTemplateEditor([
      { id: 'f2', field_name: 'B', order: 1 },
      { id: 'f1', field_name: 'A', order: 0 },
    ]));
    expect(result.current.fields.map(f => f.id)).toEqual(['f1', 'f2']);
  });
});
