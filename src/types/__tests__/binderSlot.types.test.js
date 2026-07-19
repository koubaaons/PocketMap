/**
 * @fileoverview Tests for binderSlot.types.js.
 */

import { describe, it, expect } from 'vitest';
import { validateBinderSlot, createBinderSlot } from '../binderSlot.types.js';

function validBaseSlot(overrides = {}) {
  return {
    id: 'slot-1',
    userId: 'user-1',
    binderId: 'binder-1',
    cardDefId: 'card-1',
    collectionId: 'coll-1',
    pageNumber: 1,
    slotIndex: 0,
    inventoryItemId: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('validateBinderSlot', () => {
  it('accepts a fully valid slot', () => {
    expect(validateBinderSlot(validBaseSlot()).valid).toBe(true);
  });

  it('inventoryItemId: undefined is valid (pre-migration slots)', () => {
    const slot = validBaseSlot();
    delete slot.inventoryItemId;
    expect(validateBinderSlot(slot).valid).toBe(true);
  });

  it('inventoryItemId: explicit null is valid (unowned placeholder slot)', () => {
    expect(validateBinderSlot(validBaseSlot({ inventoryItemId: null })).valid).toBe(true);
  });

  it('inventoryItemId: a real string id is valid (linked to a specific copy)', () => {
    expect(validateBinderSlot(validBaseSlot({ inventoryItemId: 'inv-42' })).valid).toBe(true);
  });

  it('rejects a non-string, non-null inventoryItemId', () => {
    expect(validateBinderSlot(validBaseSlot({ inventoryItemId: 42 })).valid).toBe(false);
  });

  it('requires pageNumber to be a positive integer (pages are 1-indexed)', () => {
    expect(validateBinderSlot(validBaseSlot({ pageNumber: 0 })).valid).toBe(false);
    expect(validateBinderSlot(validBaseSlot({ pageNumber: -1 })).valid).toBe(false);
    expect(validateBinderSlot(validBaseSlot({ pageNumber: 1.5 })).valid).toBe(false);
    expect(validateBinderSlot(validBaseSlot({ pageNumber: 1 })).valid).toBe(true);
  });

  it('requires slotIndex to be a non-negative integer (0-indexed)', () => {
    expect(validateBinderSlot(validBaseSlot({ slotIndex: -1 })).valid).toBe(false);
    expect(validateBinderSlot(validBaseSlot({ slotIndex: 0 })).valid).toBe(true);
  });

  it('requires binderId/cardDefId/collectionId/userId to be non-empty strings', () => {
    for (const field of ['binderId', 'cardDefId', 'collectionId', 'userId']) {
      expect(validateBinderSlot(validBaseSlot({ [field]: '' })).valid).toBe(false);
    }
  });
});

describe('createBinderSlot', () => {
  it('creates a valid slot with no inventoryItemId by default (unowned placeholder)', () => {
    const { slot, errors } = createBinderSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'coll-1', pageNumber: 1, slotIndex: 0,
    });
    expect(errors).toEqual([]);
    expect(slot.inventoryItemId).toBeNull();
  });

  it('creates a slot linked to a specific copy when given one', () => {
    const { slot } = createBinderSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'coll-1', pageNumber: 1, slotIndex: 0,
      inventoryItemId: 'inv-42',
    });
    expect(slot.inventoryItemId).toBe('inv-42');
  });

  it('coerces pageNumber/slotIndex to numbers (defensive against string input from forms)', () => {
    const { slot } = createBinderSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'coll-1', pageNumber: '2', slotIndex: '3',
    });
    expect(slot.pageNumber).toBe(2);
    expect(slot.slotIndex).toBe(3);
  });

  it('returns null slot and real errors for an invalid pageNumber', () => {
    const { slot, errors } = createBinderSlot({
      binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'coll-1', pageNumber: 0, slotIndex: 0,
    });
    expect(slot).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});