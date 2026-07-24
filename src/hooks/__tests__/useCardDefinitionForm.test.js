// @vitest-environment jsdom
/**
 * @fileoverview Tests for useCardDefinitionForm.js.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardDefinitionForm } from '../useCardDefinitionForm.js';

const COLLECTION = { id: 'col-1' };
const SORTED_FIELDS = [
  { field_name: 'rarity_tier', field_type: 'text', is_required: true },
  { field_name: 'is_holo', field_type: 'boolean', is_required: false },
  { field_name: 'set_number', field_type: 'number', is_required: false },
];

describe('useCardDefinitionForm — initial values', () => {
  it('defaults name/image_url/holoType/rarity to empty when creating a brand new card', () => {
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard: null, mode: 'create', onSubmit: vi.fn(),
    }));

    expect(result.current.values).toMatchObject({ name: '', image_url: null, holoType: 'none', rarity: '' });
  });

  it('seeds values from initialCard when editing an existing card', () => {
    const initialCard = { name: 'Charizard', image_url: 'https://x/img.jpg', holoType: 'rainbow', rarity: 'Secret Rare', attributes: { rarity_tier: 'S' } };
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: SORTED_FIELDS, initialCard, mode: 'edit', onSubmit: vi.fn(),
    }));

    expect(result.current.values).toMatchObject({ name: 'Charizard', holoType: 'rainbow', rarity: 'Secret Rare', rarity_tier: 'S' });
  });

  it('gives each custom field a type-appropriate default when the card has no value for it yet', () => {
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: SORTED_FIELDS, initialCard: null, mode: 'create', onSubmit: vi.fn(),
    }));

    expect(result.current.values.rarity_tier).toBe('');
    expect(result.current.values.is_holo).toBe(false);
    expect(result.current.values.set_number).toBe('');
  });

  it('defaults holoType to "none" for a card that predates the holoType field entirely', () => {
    const initialCard = { name: 'Old Card' }; // no holoType at all
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard, mode: 'edit', onSubmit: vi.fn(),
    }));

    expect(result.current.values.holoType).toBe('none');
  });
});

describe('useCardDefinitionForm — set() and reset()', () => {
  it('set() updates a value and clears that field\'s existing error', () => {
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard: null, mode: 'create', onSubmit: vi.fn(),
    }));

    act(() => result.current.handleSubmit()); // triggers validation, name is required -> sets an error
    expect(result.current.errors.name).toBeTruthy();

    act(() => result.current.set('name', 'Pikachu'));
    expect(result.current.values.name).toBe('Pikachu');
    expect(result.current.errors.name).toBeUndefined();
  });

  it('reset() restores values to the real initial card and clears errors', () => {
    const initialCard = { name: 'Pikachu' };
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard, mode: 'edit', onSubmit: vi.fn(),
    }));

    act(() => result.current.set('name', ''));
    act(() => result.current.handleSubmit()); // sets a validation error
    act(() => result.current.reset());

    expect(result.current.values.name).toBe('Pikachu');
    expect(result.current.errors).toEqual({});
  });
});

describe('useCardDefinitionForm — validation', () => {
  it('rejects submission with no card name', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard: null, mode: 'create', onSubmit,
    }));

    act(() => result.current.handleSubmit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.name).toBe('Card name is required');
  });

  it('rejects submission when a required custom field is blank', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: SORTED_FIELDS, initialCard: null, mode: 'create', onSubmit,
    }));

    act(() => result.current.set('name', 'Pikachu')); // name is fine, rarity_tier (required) is still blank

    act(() => result.current.handleSubmit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.rarity_tier).toBeTruthy();
  });

  it('does not flag a non-required custom field as an error when blank', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: SORTED_FIELDS, initialCard: null, mode: 'create', onSubmit,
    }));

    act(() => result.current.set('name', 'Pikachu'));
    act(() => result.current.set('rarity_tier', 'Common'));
    act(() => result.current.handleSubmit());

    expect(result.current.errors.set_number).toBeUndefined(); // not required, blank is fine
  });
});

describe('useCardDefinitionForm — submit (create mode)', () => {
  it('creates a valid card definition and calls onSubmit with it', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: SORTED_FIELDS, initialCard: null, mode: 'create', onSubmit,
    }));

    act(() => result.current.set('name', 'Pikachu'));
    act(() => result.current.set('rarity_tier', 'Common'));
    act(() => result.current.handleSubmit());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.name).toBe('Pikachu');
    expect(submitted.collectionId).toBe('col-1');
    expect(submitted.attributes).toEqual({ rarity_tier: 'Common', is_holo: false, set_number: '' });
  });

  it('trims the name and rarity before creating', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard: null, mode: 'create', onSubmit,
    }));

    act(() => result.current.set('name', '  Pikachu  '));
    act(() => result.current.set('rarity', '  Common  '));
    act(() => result.current.handleSubmit());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.name).toBe('Pikachu');
    expect(submitted.rarity).toBe('Common');
  });
});

describe('useCardDefinitionForm — submit (edit mode)', () => {
  it('spreads the original card and applies the edited fields', () => {
    const onSubmit = vi.fn();
    const initialCard = { id: 'card-1', name: 'Pikachu', collectionId: 'col-1' };
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard, mode: 'edit', onSubmit,
    }));

    act(() => result.current.set('name', 'Raichu'));
    act(() => result.current.handleSubmit());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.id).toBe('card-1'); // preserved from initialCard
    expect(submitted.name).toBe('Raichu'); // edited
    expect(typeof submitted.updatedAt).toBe('number');
  });

  it('includes the edited holoType on submit — regression test for the documented bug where it used to be silently discarded', () => {
    const onSubmit = vi.fn();
    const initialCard = { id: 'card-1', name: 'Pikachu', holoType: 'none' };
    const { result } = renderHook(() => useCardDefinitionForm({
      collection: COLLECTION, sortedFields: [], initialCard, mode: 'edit', onSubmit,
    }));

    act(() => result.current.set('holoType', 'rainbow'));
    act(() => result.current.handleSubmit());

    expect(onSubmit.mock.calls[0][0].holoType).toBe('rainbow');
  });
});
