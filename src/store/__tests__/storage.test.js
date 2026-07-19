/**
 * @fileoverview Tests for storage.js's sanitizeState.
 *
 * This is the ACTUAL place the undefined-vs-null validation bug
 * caused real, user-visible data loss — testing the validators alone
 * (see types/__tests__/) proves the validation logic is correct, but
 * doesn't prove this function's dropping/orphan-filtering behavior
 * is correct too. Both need coverage.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeState, DEFAULT_STATE } from '../storage.js';

function minimalRaw(overrides = {}) {
  return {
    user: { id: 'user-1', username: 'Tester' },
    binders: [],
    bin: [],
    collections: [{ id: 'coll-1', userId: 'user-1', name: 'Test Collection', is_custom: true, import_source: null, cover_image_url: null, createdAt: 0, updatedAt: 0 }],
    templateFields: [],
    cardDefinitions: [{ id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0 }],
    inventory: [],
    binderSlots: [],
    binderInserts: [],
    binderPanels: [],
    ...overrides,
  };
}

describe('sanitizeState — the real bug this session (validation false-positives)', () => {
  it('keeps an inventory item missing optional fields entirely (the actual production bug)', () => {
    // Simulates exactly what JSON.parse produces for an item saved
    // before language/condition_rating/etc existed — the keys are
    // simply absent, not null.
    const rawItem = {
      id: 'inv-1', userId: 'user-1', cardDefId: 'card-1', collectionId: 'coll-1',
      is_tradeable: false, is_sellable: false, is_favorite: false,
      createdAt: 0, updatedAt: 0,
      // language, condition_rating, personal_notes, acquired_at all absent
    };
    const result = sanitizeState(minimalRaw({ inventory: [rawItem] }));
    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0].id).toBe('inv-1');
  });

  it('keeps a card definition missing holoType/rarity entirely (pre-existing fields added later)', () => {
    const rawCard = { id: 'card-2', collectionId: 'coll-1', name: 'Bulbasaur', attributes: {}, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ cardDefinitions: [minimalRaw().cardDefinitions[0], rawCard] }));
    expect(result.cardDefinitions.some(cd => cd.id === 'card-2')).toBe(true);
  });

  it('keeps a collection missing import_source/cover_image_url entirely — same undefined-vs-null bug found here too', () => {
    const rawCollection = { id: 'coll-2', userId: 'user-1', name: 'Another Collection', is_custom: true, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ collections: [minimalRaw().collections[0], rawCollection] }));
    expect(result.collections.some(c => c.id === 'coll-2')).toBe(true);
  });

  it('still correctly drops a genuinely invalid inventory item (missing a required field)', () => {
    const rawItem = { id: 'inv-1', /* userId missing entirely */ cardDefId: 'card-1', collectionId: 'coll-1', is_tradeable: false, is_sellable: false, is_favorite: false, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ inventory: [rawItem] }));
    expect(result.inventory).toHaveLength(0);
  });
});

describe('sanitizeState — orphan filtering', () => {
  it('drops an inventory item whose card definition no longer exists', () => {
    const rawItem = { id: 'inv-1', userId: 'user-1', cardDefId: 'does-not-exist', collectionId: 'coll-1', is_tradeable: false, is_sellable: false, is_favorite: false, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ inventory: [rawItem] }));
    expect(result.inventory).toHaveLength(0);
  });

  it('drops a card definition whose collection no longer exists', () => {
    const rawCard = { id: 'card-orphan', collectionId: 'does-not-exist', name: 'Orphan', attributes: {}, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ cardDefinitions: [rawCard] }));
    expect(result.cardDefinitions).toHaveLength(0);
  });

  it('drops a binder slot whose binder no longer exists', () => {
    const rawSlot = { id: 'slot-1', userId: 'user-1', binderId: 'does-not-exist', cardDefId: 'card-1', collectionId: 'coll-1', pageNumber: 1, slotIndex: 0, createdAt: 0 };
    const result = sanitizeState(minimalRaw({ binderSlots: [rawSlot] }));
    expect(result.binderSlots).toHaveLength(0);
  });

  it('drops a binder slot whose card definition no longer exists', () => {
    const rawSlot = { id: 'slot-1', userId: 'user-1', binderId: 'binder-1', cardDefId: 'does-not-exist', collectionId: 'coll-1', pageNumber: 1, slotIndex: 0, createdAt: 0 };
    const rawBinder = { id: 'binder-1', userId: 'user-1', name: 'B', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: 'dark', stickers: [], createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ binders: [rawBinder], binderSlots: [rawSlot] }));
    expect(result.binderSlots).toHaveLength(0);
  });

  it('drops a binder panel whose insert no longer exists (insert-type panel)', () => {
    const rawBinder = { id: 'binder-1', userId: 'user-1', name: 'B', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: 'dark', stickers: [], createdAt: 0, updatedAt: 0 };
    const rawPanel = { id: 'panel-1', userId: 'user-1', binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, panelType: 'insert', insertId: 'does-not-exist', imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 };
    const result = sanitizeState(minimalRaw({ binders: [rawBinder], binderPanels: [rawPanel] }));
    expect(result.binderPanels).toHaveLength(0);
  });

  it('keeps a binder panel whose insert genuinely exists', () => {
    const rawBinder = { id: 'binder-1', userId: 'user-1', name: 'B', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: 'dark', stickers: [], createdAt: 0, updatedAt: 0 };
    const rawInsert = { id: 'insert-1', userId: 'user-1', name: 'Art', image_url: 'https://example.com/a.jpg', createdAt: 0 };
    const rawPanel = { id: 'panel-1', userId: 'user-1', binderId: 'binder-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, panelType: 'insert', insertId: 'insert-1', imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 };
    const result = sanitizeState(minimalRaw({ binders: [rawBinder], binderInserts: [rawInsert], binderPanels: [rawPanel] }));
    expect(result.binderPanels).toHaveLength(1);
  });
});

describe('sanitizeState — general behavior', () => {
  it('falls back to the default user if the stored one is malformed', () => {
    const result = sanitizeState(minimalRaw({ user: { id: 'user-1' /* missing username */ } }));
    expect(result.user).toEqual(DEFAULT_STATE.user);
  });

  it('always resets nav — never restored from localStorage', () => {
    const result = sanitizeState(minimalRaw({ nav: { currentView: 'binder', currentBinderId: 'binder-1' } }));
    expect(result.nav).toBeUndefined();
  });

  it('handles a completely empty raw object without throwing', () => {
    expect(() => sanitizeState({})).not.toThrow();
  });

  it('backfills missing binder cosmetic fields (page_color/cover_color/stickers) rather than dropping the binder', () => {
    const rawBinder = { id: 'binder-1', userId: 'user-1', name: 'B', rows: 3, cols: 3, pages: 5, createdAt: 0, updatedAt: 0 };
    const result = sanitizeState(minimalRaw({ binders: [rawBinder] }));
    expect(result.binders).toHaveLength(1);
    expect(result.binders[0].page_color).toBeTruthy();
    expect(result.binders[0].cover_color).toBeTruthy();
    expect(Array.isArray(result.binders[0].stickers)).toBe(true);
  });
});