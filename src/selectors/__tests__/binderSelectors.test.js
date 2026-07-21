/**
 * @fileoverview Tests for binderSelectors.js, focused on the
 * quantity-tracking selectors that fed into this session's bugs.
 */

import { describe, it, expect } from 'vitest';
import {
  getFullyPlacedCardDefIds, getAllSlotsForCard, isSlotPositionFree,
  getTotalPlacedCount, getOwnedFilledSlotCount,
  buildPageSlotMap, isCardInBinder, getFilledSlotCount, getSlotById, filterCardsForBinder,
} from '../binderSelectors.js';
import { binderCapacity } from '../../utils/index.js';

function makeSlot(overrides = {}) {
  return { id: 's1', binderId: 'binder-1', cardDefId: 'card-1', pageNumber: 1, slotIndex: 0, inventoryItemId: null, ...overrides };
}
function makePanel(overrides = {}) {
  return { id: 'p1', binderId: 'binder-1', panelType: 'card', cardDefId: 'card-1', spanCols: 2, spanRows: 1, pageNumber: 1, startSlotIndex: 0, ...overrides };
}
function makeInv(id, cardDefId) {
  return { id, cardDefId };
}

describe('getFullyPlacedCardDefIds', () => {
  // === CHANGED: this function used to compare owned quantity against
  // placed count (a card was only "fully placed" once every owned
  // copy had a slot somewhere), and took an optional currentBinderId
  // to separately handle unowned placeholders per-binder. Both of
  // those were replaced by the "one binder per card" rule (#153):
  // a card is either placed somewhere (any slot or card-type panel,
  // anywhere) or it isn't — quantity owned is irrelevant, and there's
  // no per-binder distinction anymore, since a card can only ever be
  // placed in one binder, period. These tests describe that current,
  // simpler behavior; the old quantity/currentBinderId-based tests
  // that lived here are gone along with the behavior they covered.
  it('a card with a slot referencing it anywhere IS in the fully-placed set', () => {
    const result = getFullyPlacedCardDefIds([makeSlot({ cardDefId: 'card-1' })], []);
    expect(result.has('card-1')).toBe(true);
  });

  it('owning multiple copies no longer matters — one placed slot is enough, regardless of quantity', () => {
    // Previously this specific case ("2 owned, only 1 placed") was
    // NOT fully placed, since a second copy could still go somewhere
    // else. Now a card is limited to one binder total regardless of
    // how many copies exist, so a single placed slot is already the
    // whole story.
    const result = getFullyPlacedCardDefIds([makeSlot({ cardDefId: 'card-1' })], []);
    expect(result.has('card-1')).toBe(true);
  });

  it('a card with no slot or panel referencing it anywhere is NOT in the fully-placed set', () => {
    const result = getFullyPlacedCardDefIds([makeSlot({ cardDefId: 'other-card' })], []);
    expect(result.has('card-1')).toBe(false);
  });

  it('an unowned "missing" placeholder slot still counts as placed — ownership isn\'t part of this check at all anymore', () => {
    const result = getFullyPlacedCardDefIds([makeSlot({ cardDefId: 'card-1' })], []);
    expect(result.has('card-1')).toBe(true);
  });

  it('counts card-type panels toward placed, but never insert-type panels', () => {
    const cardPanel = makePanel({ cardDefId: 'card-1', panelType: 'card' });
    const insertPanel = makePanel({ id: 'p2', cardDefId: null, panelType: 'insert' });
    const result = getFullyPlacedCardDefIds([], [cardPanel, insertPanel]);
    expect(result.has('card-1')).toBe(true);
    expect(result.has(null)).toBe(false); // the insert panel's null cardDefId must never leak in
  });

  it('a card placed in one binder is excluded from being offered in a completely different binder too — the whole point of "one binder per card"', () => {
    const slotInBinderA = makeSlot({ cardDefId: 'card-1', binderId: 'binder-a' });
    const result = getFullyPlacedCardDefIds([slotInBinderA], []);
    // No currentBinderId distinction anymore — placed anywhere means
    // placed, full stop, regardless of which binder is asking.
    expect(result.has('card-1')).toBe(true);
  });
});

describe('getTotalPlacedCount', () => {
  it('counts slots and card-type panels together', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const panels = [makePanel({ id: 'p1', panelType: 'card' })];
    expect(getTotalPlacedCount(slots, panels, 'card-1')).toBe(3);
  });

  it('never counts insert-type panels', () => {
    const panels = [makePanel({ panelType: 'insert', cardDefId: null })];
    expect(getTotalPlacedCount([], panels, 'card-1')).toBe(0);
  });

  it('returns 0 for a card with no placements at all', () => {
    expect(getTotalPlacedCount([], [], 'card-1')).toBe(0);
  });
});

describe('getAllSlotsForCard', () => {
  it('returns every slot for a card across all binders, not just the first', () => {
    const slots = [
      makeSlot({ id: 's1', binderId: 'binder-1' }),
      makeSlot({ id: 's2', binderId: 'binder-2' }),
      makeSlot({ id: 's3', cardDefId: 'card-2' }),
    ];
    const result = getAllSlotsForCard(slots, 'card-1');
    expect(result.map(s => s.id)).toEqual(['s1', 's2']);
  });
});

describe('isSlotPositionFree', () => {
  it('is true when nothing occupies that exact position', () => {
    expect(isSlotPositionFree([], 'binder-1', 1, 0)).toBe(true);
  });

  it('is false once something occupies that exact position', () => {
    const slots = [makeSlot({ binderId: 'binder-1', pageNumber: 1, slotIndex: 0 })];
    expect(isSlotPositionFree(slots, 'binder-1', 1, 0)).toBe(false);
  });

  it('only checks the given binder — the same position in a different binder does not count', () => {
    const slots = [makeSlot({ binderId: 'binder-2', pageNumber: 1, slotIndex: 0 })];
    expect(isSlotPositionFree(slots, 'binder-1', 1, 0)).toBe(true);
  });
});

describe('getOwnedFilledSlotCount', () => {
  it('only counts slots whose card is actually owned, not every placed slot', () => {
    const slots = [
      makeSlot({ id: 's1', cardDefId: 'card-1' }), // owned
      makeSlot({ id: 's2', cardDefId: 'card-2' }), // NOT owned - grey placeholder
    ];
    const inventory = [makeInv('inv-1', 'card-1')];
    expect(getOwnedFilledSlotCount(slots, 'binder-1', inventory)).toBe(1);
  });

  it('counts owned card-type panels too', () => {
    const panels = [makePanel({ cardDefId: 'card-1', panelType: 'card' })];
    const inventory = [makeInv('inv-1', 'card-1')];
    expect(getOwnedFilledSlotCount([], 'binder-1', inventory, panels)).toBe(1);
  });

  it('only counts slots within the specified binder', () => {
    const slots = [makeSlot({ binderId: 'other-binder', cardDefId: 'card-1' })];
    const inventory = [makeInv('inv-1', 'card-1')];
    expect(getOwnedFilledSlotCount(slots, 'binder-1', inventory)).toBe(0);
  });
});

describe('binderCapacity', () => {
  const binder = { id: 'binder-1', rows: 3, cols: 3, pages: 10 }; // 90 raw capacity

  it('with no panels, capacity is just rows * cols * pages', () => {
    expect(binderCapacity(binder, [])).toBe(90);
  });

  it('a card-type panel still counts as ONE spot — only the extra span is removed', () => {
    const panel = makePanel({ binderId: 'binder-1', panelType: 'card', spanCols: 2, spanRows: 1 }); // 2 slots absorbed
    expect(binderCapacity(binder, [panel])).toBe(89); // 90 - (2-1)
  });

  it('an insert-type panel is NOT a card slot at all — its full span is removed, not just the extra', () => {
    const panel = makePanel({ binderId: 'binder-1', panelType: 'insert', cardDefId: null, spanCols: 2, spanRows: 1 });
    expect(binderCapacity(binder, [panel])).toBe(88); // 90 - 2 (the full span, not span-1)
  });

  it('only counts panels belonging to this specific binder', () => {
    const panel = makePanel({ binderId: 'some-other-binder', panelType: 'card', spanCols: 2, spanRows: 1 });
    expect(binderCapacity(binder, [panel])).toBe(90); // unaffected
  });
});

describe('buildPageSlotMap', () => {
  it('maps slotIndex -> slot for a specific binder + page only', () => {
    const slots = [
      makeSlot({ id: 's1', binderId: 'binder-1', pageNumber: 1, slotIndex: 0 }),
      makeSlot({ id: 's2', binderId: 'binder-1', pageNumber: 1, slotIndex: 1 }),
      makeSlot({ id: 's3', binderId: 'binder-1', pageNumber: 2, slotIndex: 0 }), // different page
      makeSlot({ id: 's4', binderId: 'binder-2', pageNumber: 1, slotIndex: 0 }), // different binder
    ];
    const map = buildPageSlotMap(slots, 'binder-1', 1);
    expect(Object.keys(map)).toHaveLength(2);
    expect(map[0].id).toBe('s1');
    expect(map[1].id).toBe('s2');
  });

  it('returns an empty object when nothing matches', () => {
    expect(buildPageSlotMap([], 'binder-1', 1)).toEqual({});
  });
});

describe('isCardInBinder', () => {
  it('true when the card has a slot in this binder', () => {
    const slots = [makeSlot({ binderId: 'binder-1', cardDefId: 'card-1' })];
    expect(isCardInBinder(slots, 'binder-1', 'card-1')).toBe(true);
  });

  it('false for a different binder or a different card', () => {
    const slots = [makeSlot({ binderId: 'binder-1', cardDefId: 'card-1' })];
    expect(isCardInBinder(slots, 'binder-2', 'card-1')).toBe(false);
    expect(isCardInBinder(slots, 'binder-1', 'card-2')).toBe(false);
  });
});

describe('getFilledSlotCount', () => {
  it('counts every slot in a binder, regardless of ownership', () => {
    const slots = [
      makeSlot({ id: 's1', binderId: 'binder-1' }),
      makeSlot({ id: 's2', binderId: 'binder-1' }),
      makeSlot({ id: 's3', binderId: 'binder-2' }),
    ];
    expect(getFilledSlotCount(slots, 'binder-1')).toBe(2);
  });
});

describe('getSlotById', () => {
  it('finds a slot by id', () => {
    const slots = [makeSlot({ id: 'slot-1' }), makeSlot({ id: 'slot-2' })];
    expect(getSlotById(slots, 'slot-2').id).toBe('slot-2');
  });

  it('returns null (not undefined) when not found', () => {
    expect(getSlotById([], 'does-not-exist')).toBeNull();
  });
});

describe('filterCardsForBinder', () => {
  const cards = [
    { id: 'card-1', name: 'Pikachu', collectionId: 'coll-1', attributes: { Rarity: 'Rare Holo' } },
    { id: 'card-2', name: 'Charizard', collectionId: 'coll-1', attributes: {} },
    { id: 'card-3', name: 'Bulbasaur', collectionId: 'coll-2', attributes: {} },
  ];
  const collectionMap = { 'coll-1': { name: 'Base Set' }, 'coll-2': { name: 'Jungle' } };

  it('excludes cards already in the placed set', () => {
    const result = filterCardsForBinder(cards, new Set(['card-1']), '', collectionMap);
    expect(result.map(c => c.id)).toEqual(['card-2', 'card-3']);
  });

  it('matches by card name (case-insensitive)', () => {
    const result = filterCardsForBinder(cards, new Set(), 'pika', collectionMap);
    expect(result.map(c => c.id)).toEqual(['card-1']);
  });

  it('matches by collection name too', () => {
    const result = filterCardsForBinder(cards, new Set(), 'jungle', collectionMap);
    expect(result.map(c => c.id)).toEqual(['card-3']);
  });

  it('matches by an attribute value (e.g. rarity)', () => {
    const result = filterCardsForBinder(cards, new Set(), 'rare holo', collectionMap);
    expect(result.map(c => c.id)).toEqual(['card-1']);
  });

  it('returns everything (minus placed) when the query is empty', () => {
    const result = filterCardsForBinder(cards, new Set(), '', collectionMap);
    expect(result).toHaveLength(3);
  });

  it('respects the limit parameter', () => {
    const result = filterCardsForBinder(cards, new Set(), '', collectionMap, 2);
    expect(result).toHaveLength(2);
  });
});