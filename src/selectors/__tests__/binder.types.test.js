/**
 * @fileoverview Tests for binder.types.js — untested before despite
 * significant binder cover/sticker work this session.
 */

import { describe, it, expect } from 'vitest';
import { validateBinder, createBinder, createSticker, BINDER_COLORS, DEFAULT_BINDER_COLOR } from '../binder.types.js';

function validSticker(overrides = {}) {
  return { id: 'sticker-1', image_url: 'data:image/png;base64,abc', x: 50, y: 50, rotation: 0, scale: 1, size: 17.5, ...overrides };
}

function validBaseBinder(overrides = {}) {
  return {
    id: 'binder-1', userId: 'user-1', name: 'My Binder',
    cols: 3, rows: 3, pages: 10,
    cover_color: '#e8627a', page_color: '#1e1e1e', stickers: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('validateBinder', () => {
  it('accepts a fully valid binder', () => {
    expect(validateBinder(validBaseBinder()).valid).toBe(true);
  });

  it('requires cols/rows to be integers within 1-10', () => {
    expect(validateBinder(validBaseBinder({ cols: 0 })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ cols: 11 })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ cols: 3.5 })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ rows: 0 })).valid).toBe(false);
  });

  it('requires pages to be an integer within 1-500', () => {
    expect(validateBinder(validBaseBinder({ pages: 0 })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ pages: 501 })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ pages: 500 })).valid).toBe(true);
  });

  it('requires cover_color to be a hex string', () => {
    expect(validateBinder(validBaseBinder({ cover_color: 'not-hex' })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ cover_color: '#123456' })).valid).toBe(true);
  });

  describe('page_color — accepts legacy presets AND hex, for backward compat', () => {
    it('accepts the legacy "dark" preset string', () => {
      expect(validateBinder(validBaseBinder({ page_color: 'dark' })).valid).toBe(true);
    });
    it('accepts the legacy "light" preset string', () => {
      expect(validateBinder(validBaseBinder({ page_color: 'light' })).valid).toBe(true);
    });
    it('accepts any hex color', () => {
      expect(validateBinder(validBaseBinder({ page_color: '#abcdef' })).valid).toBe(true);
    });
    it('rejects any other string', () => {
      expect(validateBinder(validBaseBinder({ page_color: 'blue' })).valid).toBe(false);
    });
  });

  it('requires stickers to be an array', () => {
    expect(validateBinder(validBaseBinder({ stickers: 'not-an-array' })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ stickers: null })).valid).toBe(false);
  });

  it('validates every sticker in the array, prefixing errors with its index', () => {
    const { valid, errors } = validateBinder(validBaseBinder({ stickers: [validSticker(), validSticker({ x: 200 })] }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.startsWith('stickers[1]'))).toBe(true);
  });

  it('accepts multiple valid stickers', () => {
    const { valid } = validateBinder(validBaseBinder({ stickers: [validSticker({ id: 's1' }), validSticker({ id: 's2', x: 20, y: 80 })] }));
    expect(valid).toBe(true);
  });

  it('requires a non-empty, non-whitespace name', () => {
    expect(validateBinder(validBaseBinder({ name: '' })).valid).toBe(false);
    expect(validateBinder(validBaseBinder({ name: '   ' })).valid).toBe(false);
  });
});

describe('createBinder', () => {
  it('creates a valid binder with just the required fields', () => {
    const { binder, errors } = createBinder({ name: 'Test', cols: 3, rows: 3, pages: 10 });
    expect(errors).toEqual([]);
    expect(binder.stickers).toEqual([]);
    expect(binder.cover_color).toBe(DEFAULT_BINDER_COLOR);
  });

  it('defaults page_color to the hex equivalent of the old "dark" preset', () => {
    const { binder } = createBinder({ name: 'Test', cols: 3, rows: 3, pages: 10 });
    expect(binder.page_color).toBe('#1e1e1e');
  });

  it('coerces cols/rows/pages to numbers (defensive against string input from forms)', () => {
    const { binder } = createBinder({ name: 'Test', cols: '4', rows: '4', pages: '20' });
    expect(binder.cols).toBe(4);
    expect(binder.rows).toBe(4);
    expect(binder.pages).toBe(20);
  });

  it('returns null binder and real errors for an invalid pages value', () => {
    const { binder, errors } = createBinder({ name: 'Test', cols: 3, rows: 3, pages: 0 });
    expect(binder).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('every entry in BINDER_COLORS is itself a valid hex string', () => {
    BINDER_COLORS.forEach(color => expect(color.startsWith('#')).toBe(true));
  });
});

describe('createSticker', () => {
  it('creates a valid sticker with sensible defaults', () => {
    const { sticker, errors } = createSticker({ image_url: 'data:image/png;base64,abc', x: 50, y: 50 });
    expect(errors).toEqual([]);
    expect(sticker.rotation).toBe(0);
    expect(sticker.scale).toBe(1);
    expect(sticker.size).toBe(17.5);
  });

  it('generates a distinct id per sticker', () => {
    const { sticker: a } = createSticker({ image_url: 'x', x: 0, y: 0 });
    const { sticker: b } = createSticker({ image_url: 'x', x: 0, y: 0 });
    expect(a.id).not.toBe(b.id);
  });

  it('rejects x/y outside the 0-100 percentage range', () => {
    expect(createSticker({ image_url: 'x', x: -1, y: 50 }).sticker).toBeNull();
    expect(createSticker({ image_url: 'x', x: 101, y: 50 }).sticker).toBeNull();
  });

  it('rejects a scale outside 0.4-10', () => {
    expect(createSticker({ image_url: 'x', x: 50, y: 50, scale: 0.1 }).sticker).toBeNull();
    expect(createSticker({ image_url: 'x', x: 50, y: 50, scale: 11 }).sticker).toBeNull();
  });

  it('rejects a size outside 5-60', () => {
    expect(createSticker({ image_url: 'x', x: 50, y: 50, size: 1 }).sticker).toBeNull();
    expect(createSticker({ image_url: 'x', x: 50, y: 50, size: 100 }).sticker).toBeNull();
  });

  it('requires a non-empty image_url', () => {
    expect(createSticker({ image_url: '', x: 50, y: 50 }).sticker).toBeNull();
  });
});