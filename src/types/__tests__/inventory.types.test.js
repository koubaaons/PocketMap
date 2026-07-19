/**
 * @fileoverview Tests for inventory.types.js.
 *
 * Priority #1: the undefined-vs-null validation bug. This hit FOUR
 * separate fields this session (language, condition_rating,
 * personal_notes, acquired_at) — a check like
 * `data.field !== null && !ENUM.includes(data.field)` looks correct
 * but incorrectly rejects `undefined` too, since `undefined !== null`
 * is true. In practice this meant any existing inventory row missing
 * a field entirely (e.g. one created before that field existed, since
 * JSON.stringify/parse silently drops undefined keys) got dropped as
 * "corrupt" on load. Every optional field gets an explicit test for
 * exactly this, so a future field added the same buggy way fails a
 * test immediately instead of silently corrupting real user data.
 */

import { describe, it, expect } from 'vitest';
import { validateInventoryItem, createInventoryItem, CONDITION_RATINGS, LANGUAGE_OPTIONS } from '../inventory.types.js';

function validBaseItem(overrides = {}) {
  return {
    id: 'inv-1',
    userId: 'user-1',
    cardDefId: 'card-1',
    collectionId: 'coll-1',
    condition_rating: null,
    language: null,
    is_tradeable: false,
    is_sellable: false,
    is_favorite: false,
    personal_notes: null,
    acquired_at: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('validateInventoryItem', () => {
  it('accepts a fully valid item', () => {
    const { valid, errors } = validateInventoryItem(validBaseItem());
    expect(valid).toBe(true);
    expect(errors).toEqual([]);
  });

  describe('the undefined-vs-null bug class (found 4x this session)', () => {
    // Each of these fields is optional/nullable. An item missing the
    // field entirely (undefined) must be treated the same as
    // explicitly null — NOT as an invalid value. This is exactly the
    // bug that dropped real existing inventory rows as "corrupt".
    const optionalFields = ['condition_rating', 'language', 'personal_notes', 'acquired_at'];

    it.each(optionalFields)('%s: undefined is valid, same as null', (field) => {
      const item = validBaseItem();
      delete item[field]; // simulates a real row missing this key entirely, e.g. from JSON.parse on older data
      const { valid, errors } = validateInventoryItem(item);
      expect(valid).toBe(true);
      expect(errors).toEqual([]);
    });

    it.each(optionalFields)('%s: explicit null is valid', (field) => {
      const item = validBaseItem({ [field]: null });
      const { valid } = validateInventoryItem(item);
      expect(valid).toBe(true);
    });
  });

  it('rejects an invalid condition_rating value (not just missing)', () => {
    const { valid, errors } = validateInventoryItem(validBaseItem({ condition_rating: 'not-a-real-rating' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('condition_rating'))).toBe(true);
  });

  it('accepts every real condition rating', () => {
    for (const rating of CONDITION_RATINGS) {
      const { valid } = validateInventoryItem(validBaseItem({ condition_rating: rating }));
      expect(valid).toBe(true);
    }
  });

  it('rejects an invalid language value (not just missing)', () => {
    const { valid, errors } = validateInventoryItem(validBaseItem({ language: 'klingon' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('language'))).toBe(true);
  });

  it('accepts every real language option', () => {
    for (const lang of LANGUAGE_OPTIONS) {
      const { valid } = validateInventoryItem(validBaseItem({ language: lang }));
      expect(valid).toBe(true);
    }
  });

  it('rejects a non-string personal_notes (e.g. accidentally a number)', () => {
    const { valid } = validateInventoryItem(validBaseItem({ personal_notes: 12345 }));
    expect(valid).toBe(false);
  });

  it('rejects a non-numeric acquired_at', () => {
    const { valid } = validateInventoryItem(validBaseItem({ acquired_at: '2024-01-01' }));
    expect(valid).toBe(false);
  });

  it('requires id/userId/cardDefId/collectionId to be non-empty strings', () => {
    for (const field of ['id', 'userId', 'cardDefId', 'collectionId']) {
      const { valid, errors } = validateInventoryItem(validBaseItem({ [field]: '' }));
      expect(valid).toBe(false);
      expect(errors.some(e => e.includes(field))).toBe(true);
    }
  });

  it('requires is_tradeable/is_sellable/is_favorite to be actual booleans', () => {
    for (const field of ['is_tradeable', 'is_sellable', 'is_favorite']) {
      const { valid } = validateInventoryItem(validBaseItem({ [field]: 'yes' }));
      expect(valid).toBe(false);
    }
  });

  it('rejects non-object input entirely', () => {
    expect(validateInventoryItem(null).valid).toBe(false);
    expect(validateInventoryItem(undefined).valid).toBe(false);
    expect(validateInventoryItem('a string').valid).toBe(false);
  });
});

describe('createInventoryItem', () => {
  it('creates a valid item with just the required fields', () => {
    const { item, errors } = createInventoryItem({ cardDefId: 'card-1', collectionId: 'coll-1' });
    expect(errors).toEqual([]);
    expect(item).not.toBeNull();
    expect(item.cardDefId).toBe('card-1');
    expect(item.condition_rating).toBeNull();
    expect(item.language).toBeNull();
  });

  it('generates a distinct id for every call (needed for owning multiple copies)', () => {
    const { item: a } = createInventoryItem({ cardDefId: 'card-1', collectionId: 'coll-1' });
    const { item: b } = createInventoryItem({ cardDefId: 'card-1', collectionId: 'coll-1' });
    expect(a.id).not.toBe(b.id);
  });

  it('accepts an explicit language and condition', () => {
    const { item } = createInventoryItem({
      cardDefId: 'card-1',
      collectionId: 'coll-1',
      language: 'japanese',
      condition_rating: 'mint',
    });
    expect(item.language).toBe('japanese');
    expect(item.condition_rating).toBe('mint');
  });

  it('returns null item and real errors when given an invalid value', () => {
    const { item, errors } = createInventoryItem({
      cardDefId: 'card-1',
      collectionId: 'coll-1',
      language: 'not-a-real-language',
    });
    expect(item).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});