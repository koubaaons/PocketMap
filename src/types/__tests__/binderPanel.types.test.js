/**
 * @fileoverview Tests for binderPanel.types.js.
 */

import { describe, it, expect } from 'vitest';
import { validateBinderPanel, createBinderPanel } from '../binderPanel.types.js';

function validCardPanel(overrides = {}) {
  return {
    id: 'panel-1', userId: 'user-1', binderId: 'binder-1',
    pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1,
    panelType: 'card', cardDefId: 'card-1', insertId: null,
    inventoryItemId: null, imageX: 50, imageY: 50, imageScale: 1,
    createdAt: Date.now(),
    ...overrides,
  };
}

function validInsertPanel(overrides = {}) {
  return {
    ...validCardPanel(overrides),
    panelType: 'insert', cardDefId: null, insertId: 'insert-1',
    ...overrides,
  };
}

describe('validateBinderPanel', () => {
  it('accepts a valid card-type panel', () => {
    expect(validateBinderPanel(validCardPanel()).valid).toBe(true);
  });

  it('accepts a valid insert-type panel', () => {
    expect(validateBinderPanel(validInsertPanel()).valid).toBe(true);
  });

  it('rejects a 1x1 panel — that is just a normal slot, not a combined one', () => {
    const { valid, errors } = validateBinderPanel(validCardPanel({ spanCols: 1, spanRows: 1 }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('more than one slot'))).toBe(true);
  });

  it('accepts spans other than 2x1 (e.g. 1x2, 2x2)', () => {
    expect(validateBinderPanel(validCardPanel({ spanCols: 1, spanRows: 2 })).valid).toBe(true);
    expect(validateBinderPanel(validCardPanel({ spanCols: 2, spanRows: 2 })).valid).toBe(true);
  });

  it('requires cardDefId when panelType is "card"', () => {
    expect(validateBinderPanel(validCardPanel({ cardDefId: null })).valid).toBe(false);
  });

  it('allows a null insertId when panelType is "insert" — a blank combined panel is legitimate (fresh, or its image was soft-deleted from the library)', () => {
    expect(validateBinderPanel(validInsertPanel({ insertId: null })).valid).toBe(true);
  });

  it('still rejects a non-string, non-null insertId', () => {
    expect(validateBinderPanel(validInsertPanel({ insertId: 42 })).valid).toBe(false);
  });

  it('rejects an invalid panelType', () => {
    expect(validateBinderPanel(validCardPanel({ panelType: 'something-else' })).valid).toBe(false);
  });

  describe('inventoryItemId (quantity tracking link)', () => {
    it('undefined is valid', () => {
      const panel = validCardPanel();
      delete panel.inventoryItemId;
      expect(validateBinderPanel(panel).valid).toBe(true);
    });

    it('explicit null is valid (unowned placeholder panel)', () => {
      expect(validateBinderPanel(validCardPanel({ inventoryItemId: null })).valid).toBe(true);
    });

    it('a real string id is valid', () => {
      expect(validateBinderPanel(validCardPanel({ inventoryItemId: 'inv-1' })).valid).toBe(true);
    });

    it('rejects a non-string, non-null value', () => {
      expect(validateBinderPanel(validCardPanel({ inventoryItemId: 42 })).valid).toBe(false);
    });
  });

  describe('image position/scale', () => {
    it('imageX/imageY must be within 0-100', () => {
      expect(validateBinderPanel(validCardPanel({ imageX: -1 })).valid).toBe(false);
      expect(validateBinderPanel(validCardPanel({ imageX: 101 })).valid).toBe(false);
      expect(validateBinderPanel(validCardPanel({ imageX: 0 })).valid).toBe(true);
      expect(validateBinderPanel(validCardPanel({ imageX: 100 })).valid).toBe(true);
    });

    it('imageScale must be within 0.2-10', () => {
      expect(validateBinderPanel(validCardPanel({ imageScale: 0.1 })).valid).toBe(false);
      expect(validateBinderPanel(validCardPanel({ imageScale: 11 })).valid).toBe(false);
      expect(validateBinderPanel(validCardPanel({ imageScale: 1 })).valid).toBe(true);
    });
  });

  it('requires spanCols/spanRows/startSlotIndex to be valid integers', () => {
    expect(validateBinderPanel(validCardPanel({ spanCols: 1.5 })).valid).toBe(false);
    expect(validateBinderPanel(validCardPanel({ spanCols: 0 })).valid).toBe(false);
    expect(validateBinderPanel(validCardPanel({ startSlotIndex: -1 })).valid).toBe(false);
  });
});

describe('createBinderPanel', () => {
  it('creates a valid card-type panel', () => {
    const { panel, errors } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1,
      panelType: 'card', cardDefId: 'card-1',
    });
    expect(errors).toEqual([]);
    expect(panel.panelType).toBe('card');
    expect(panel.insertId).toBeNull(); // forced null even if accidentally passed for a card panel
  });

  it('creates a valid insert-type panel, forcing cardDefId/inventoryItemId to null', () => {
    const { panel, errors } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1,
      panelType: 'insert', insertId: 'insert-1', cardDefId: 'sneaky-card-id', inventoryItemId: 'sneaky-inv-id',
    });
    expect(errors).toEqual([]);
    expect(panel.cardDefId).toBeNull();
    expect(panel.inventoryItemId).toBeNull(); // insert panels never carry a copy link
  });

  it('defaults image position to centered, scale 1', () => {
    const { panel } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1,
      panelType: 'card', cardDefId: 'card-1',
    });
    expect(panel.imageX).toBe(50);
    expect(panel.imageY).toBe(50);
    expect(panel.imageScale).toBe(1);
  });

  it('returns null panel and real errors for a 1x1 span', () => {
    const { panel, errors } = createBinderPanel({
      binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 1, spanRows: 1,
      panelType: 'card', cardDefId: 'card-1',
    });
    expect(panel).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});