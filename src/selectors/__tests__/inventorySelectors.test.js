/**
 * @fileoverview Tests for inventorySelectors.js.
 *
 * buildOwnershipMap gets the most attention here — it used to
 * silently overwrite map[cardDefId] on every matching row, so with
 * multiple copies of a card, whichever one happened to iterate LAST
 * won (not the oldest, not any deliberate choice — just array order).
 * Now deterministic (earliest acquired_at/createdAt wins), and these
 * tests exist specifically to catch a regression back to
 * "last-write-wins" if this function is ever touched again.
 */

import { describe, it, expect } from 'vitest';
import {
  isOwned, getInventoryItem, buildOwnershipMap, buildInventoryGroupMap,
  getQuantityOwned, getOwnedCards, getMissingCards, getUnorganisedCards,
  buildCollectionSummary,
} from '../inventorySelectors.js';

function makeItem(id, cardDefId, overrides = {}) {
  return { id, cardDefId, is_favorite: false, createdAt: 0, acquired_at: null, ...overrides };
}

describe('isOwned / getInventoryItem', () => {
  it('isOwned is true when a matching record exists, false otherwise', () => {
    const inventory = [makeItem('inv-1', 'card-1')];
    expect(isOwned(inventory, 'card-1')).toBe(true);
    expect(isOwned(inventory, 'card-2')).toBe(false);
  });

  it('getInventoryItem returns null (not undefined) when nothing matches', () => {
    expect(getInventoryItem([], 'card-1')).toBeNull();
  });
});

describe('buildOwnershipMap', () => {
  it('single copy: maps straightforwardly', () => {
    const map = buildOwnershipMap([makeItem('inv-1', 'card-1')]);
    expect(map['card-1'].id).toBe('inv-1');
  });

  it('multiple copies: deterministically picks the EARLIEST acquired copy, not whichever iterates last', () => {
    const inventory = [
      makeItem('inv-late', 'card-1', { acquired_at: 300 }),
      makeItem('inv-earliest', 'card-1', { acquired_at: 100 }),
      makeItem('inv-middle', 'card-1', { acquired_at: 200 }),
    ];
    const map = buildOwnershipMap(inventory);
    expect(map['card-1'].id).toBe('inv-earliest');
  });

  it('is stable regardless of array order (the actual bug this replaced)', () => {
    const a = makeItem('inv-a', 'card-1', { acquired_at: 100 });
    const b = makeItem('inv-b', 'card-1', { acquired_at: 200 });
    const mapForward  = buildOwnershipMap([a, b]);
    const mapReversed = buildOwnershipMap([b, a]);
    expect(mapForward['card-1'].id).toBe(mapReversed['card-1'].id);
    expect(mapForward['card-1'].id).toBe('inv-a'); // the earlier one, regardless of order
  });

  it('falls back to createdAt when acquired_at is null', () => {
    const inventory = [
      makeItem('inv-a', 'card-1', { acquired_at: null, createdAt: 200 }),
      makeItem('inv-b', 'card-1', { acquired_at: null, createdAt: 100 }),
    ];
    const map = buildOwnershipMap(inventory);
    expect(map['card-1'].id).toBe('inv-b');
  });

  it('cards with no inventory rows simply have no key at all', () => {
    const map = buildOwnershipMap([makeItem('inv-1', 'card-1')]);
    expect(map['card-2']).toBeUndefined();
  });
});

describe('buildInventoryGroupMap', () => {
  it('groups every copy under its cardDefId, not just one representative', () => {
    const inventory = [
      makeItem('inv-1', 'card-1'),
      makeItem('inv-2', 'card-1'),
      makeItem('inv-3', 'card-2'),
    ];
    const map = buildInventoryGroupMap(inventory);
    expect(map['card-1']).toHaveLength(2);
    expect(map['card-2']).toHaveLength(1);
  });

  it('a card with zero copies has no key (not an empty array)', () => {
    const map = buildInventoryGroupMap([]);
    expect(map['card-1']).toBeUndefined();
  });
});

describe('getQuantityOwned', () => {
  it('counts every copy for a card', () => {
    const map = buildInventoryGroupMap([makeItem('inv-1', 'card-1'), makeItem('inv-2', 'card-1')]);
    expect(getQuantityOwned(map, 'card-1')).toBe(2);
  });

  it('returns 0 for a card with no copies at all (not undefined, not an error)', () => {
    expect(getQuantityOwned({}, 'card-1')).toBe(0);
  });
});

describe('getOwnedCards / getMissingCards / getUnorganisedCards', () => {
  const cards = [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }];
  const ownershipMap = { 'card-1': makeItem('inv-1', 'card-1'), 'card-2': makeItem('inv-2', 'card-2') };

  it('getOwnedCards returns only cards with an ownership record', () => {
    expect(getOwnedCards(cards, ownershipMap).map(c => c.id)).toEqual(['card-1', 'card-2']);
  });

  it('getMissingCards returns only cards without one', () => {
    expect(getMissingCards(cards, ownershipMap).map(c => c.id)).toEqual(['card-3']);
  });

  it('getUnorganisedCards returns owned cards NOT in a binder slot', () => {
    const result = getUnorganisedCards(cards, ownershipMap, ['card-1']); // card-1 is placed
    expect(result.map(c => c.id)).toEqual(['card-2']); // card-2 owned but unplaced; card-3 not owned at all
  });
});

describe('buildCollectionSummary', () => {
  it('computes total/owned/missing/unorganised/pct correctly', () => {
    const cards = [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }, { id: 'card-4' }];
    const ownershipMap = {
      'card-1': makeItem('inv-1', 'card-1'),
      'card-2': makeItem('inv-2', 'card-2'),
    };
    const summary = buildCollectionSummary(cards, ownershipMap, ['card-1']); // card-1 placed, card-2 not
    expect(summary.total).toBe(4);
    expect(summary.owned).toBe(2);
    expect(summary.missing).toBe(2);
    expect(summary.unorganised).toBe(1); // just card-2
    expect(summary.pct).toBe(50);
  });

  it('handles an empty collection without dividing by zero', () => {
    const summary = buildCollectionSummary([], {});
    expect(summary.total).toBe(0);
    expect(summary.pct).toBe(0);
  });
});