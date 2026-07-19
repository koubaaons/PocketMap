/**
 * @fileoverview Tests for binderInsert.types.js.
 */

import { describe, it, expect } from 'vitest';
import { validateBinderInsert, createBinderInsert } from '../binderInsert.types.js';

function validInsert(overrides = {}) {
  return {
    id: 'insert-1', userId: 'user-1', name: 'Cool Art',
    image_url: 'https://example.com/art.jpg', createdAt: Date.now(),
    ...overrides,
  };
}

describe('validateBinderInsert', () => {
  it('accepts a valid insert', () => {
    expect(validateBinderInsert(validInsert()).valid).toBe(true);
  });

  it('requires a non-empty name (not just whitespace)', () => {
    expect(validateBinderInsert(validInsert({ name: '' })).valid).toBe(false);
    expect(validateBinderInsert(validInsert({ name: '   ' })).valid).toBe(false);
  });

  it('requires a non-empty image_url — unlike a card, an insert with no image makes no sense at all', () => {
    expect(validateBinderInsert(validInsert({ image_url: '' })).valid).toBe(false);
    expect(validateBinderInsert(validInsert({ image_url: null })).valid).toBe(false);
  });

  it('requires id/userId to be non-empty strings', () => {
    expect(validateBinderInsert(validInsert({ id: '' })).valid).toBe(false);
    expect(validateBinderInsert(validInsert({ userId: '' })).valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateBinderInsert(null).valid).toBe(false);
    expect(validateBinderInsert(undefined).valid).toBe(false);
  });
});

describe('createBinderInsert', () => {
  it('creates a valid insert', () => {
    const { insert, errors } = createBinderInsert({ name: 'Cool Art', image_url: 'https://example.com/art.jpg' });
    expect(errors).toEqual([]);
    expect(insert.name).toBe('Cool Art');
  });

  it('trims whitespace from the name', () => {
    const { insert } = createBinderInsert({ name: '  Cool Art  ', image_url: 'https://example.com/art.jpg' });
    expect(insert.name).toBe('Cool Art');
  });

  it('returns null insert and real errors when image_url is missing', () => {
    const { insert, errors } = createBinderInsert({ name: 'Cool Art', image_url: '' });
    expect(insert).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});