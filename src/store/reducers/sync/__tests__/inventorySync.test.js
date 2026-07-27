/**
 * @fileoverview Tests for inventorySync.js.
 *
 * Written after two real bugs were found via live testing (a 409
 * error on unown/reown, and a card staying greyed out in a binder
 * after unowning its only copy):
 *
 * (1) INVENTORY_ADD used to push the inventory upsert and the slot/
 * panel auto-link update as two independent, unordered promises.
 * binder_slots.inventory_item_id has a real foreign key against
 * user_inventory(id) — if the auto-link update reached the database
 * before the insert had actually committed, it failed outright with
 * a foreign-key violation. A race, not a guaranteed failure, which
 * is exactly why it only showed up intermittently.
 *
 * (2) INVENTORY_DELETE's diff logic was written for the reducer's OLD
 * behavior (unlink a slot by nulling its inventoryItemId) and was
 * never updated when the reducer was changed to REMOVE the slot
 * entirely instead (#165). The stale diff never matched anything
 * once that shipped, meaning the actual Supabase row was never
 * deleted at all — it just sat there, silently reappearing on the
 * next reload as a "missing" placeholder once the real foreign key's
 * ON DELETE SET NULL cleared its dangling reference automatically.
 *
 * These tests check both fixes directly: correct ordering for (1),
 * and correct removed-vs-unlinked detection for (2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACTIONS } from '../../../actionTypes.js';

const callLog = [];
function makeQueryResult(table, method) {
  return {
    eq: (col, val) => {
      const p = Promise.resolve({ error: null });
      p.then(() => callLog.push({ table, method, col, val }));
      return p;
    },
  };
}

const mockUpsert = vi.fn();
const mockFrom = vi.fn((table) => ({
  upsert: (row) => { mockUpsert(table, row); return Promise.resolve({ error: null }); },
  update: (patch) => ({ eq: (col, val) => {
    callLog.push({ table, method: 'update', patch, col, val });
    return Promise.resolve({ error: null });
  } }),
  delete: () => makeQueryResult(table, 'delete'),
}));

vi.mock('../../../../services/supabase.js', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}));

vi.mock('../syncHelpers.js', () => ({
  upsertInventoryItem: vi.fn((item) => {
    // Deliberately delayed, not resolved synchronously — if the
    // auto-link update below were NOT genuinely waiting on this
    // (the exact bug being tested for), it would log before this
    // does, since it resolves instantly. A same-tick mock wouldn't
    // be able to tell "properly sequenced" apart from "coincidentally
    // logged in the right order regardless".
    return new Promise(resolve => {
      setTimeout(() => {
        callLog.push({ table: 'user_inventory', method: 'upsert', id: item.id });
        resolve();
      }, 10);
    });
  }),
}));

function makeSlot(overrides = {}) {
  return { id: 'slot-1', binderId: 'binder-1', cardDefId: 'card-1', collectionId: 'col-1', pageNumber: 1, slotIndex: 0, inventoryItemId: null, ...overrides };
}

describe('inventorySync — INVENTORY_ADD', () => {
  let inventorySync;

  beforeEach(async () => {
    callLog.length = 0;
    mockUpsert.mockClear();
    mockFrom.mockClear();
    ({ inventorySync } = await import('../inventorySync.js'));
  });

  it('upserts the new inventory item, with no auto-link when no slot/panel actually transitioned to linked', async () => {
    const pending = [];
    const prevState = { binderSlots: [], binderPanels: [] };
    const nextState = { inventory: [{ id: 'inv-1', cardDefId: 'card-1' }], binderSlots: [], binderPanels: [] };

    inventorySync({ type: ACTIONS.INVENTORY_ADD, payload: { id: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toEqual([{ table: 'user_inventory', method: 'upsert', id: 'inv-1' }]);
  });

  it('auto-links a slot that transitioned from unlinked to linked, AFTER the inventory upsert completes', async () => {
    const pending = [];
    const prevState = { binderSlots: [makeSlot({ inventoryItemId: null })], binderPanels: [] };
    const nextState = {
      inventory: [{ id: 'inv-1', cardDefId: 'card-1' }],
      binderSlots: [makeSlot({ inventoryItemId: 'inv-1' })],
      binderPanels: [],
    };

    inventorySync({ type: ACTIONS.INVENTORY_ADD, payload: { id: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toEqual([
      { table: 'user_inventory', method: 'upsert', id: 'inv-1' },
      { table: 'binder_slots', method: 'update', patch: { inventory_item_id: 'inv-1' }, col: 'id', val: 'slot-1' },
    ]);
  });

  it('does not auto-link a slot that was already linked before this add (not a real transition)', async () => {
    const pending = [];
    const prevState = { binderSlots: [makeSlot({ inventoryItemId: 'inv-old' })], binderPanels: [] };
    const nextState = {
      inventory: [{ id: 'inv-1', cardDefId: 'card-1' }],
      binderSlots: [makeSlot({ inventoryItemId: 'inv-old' })], // unchanged
      binderPanels: [],
    };

    inventorySync({ type: ACTIONS.INVENTORY_ADD, payload: { id: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toEqual([{ table: 'user_inventory', method: 'upsert', id: 'inv-1' }]);
  });
});

describe('inventorySync — INVENTORY_DELETE', () => {
  let inventorySync;

  beforeEach(async () => {
    callLog.length = 0;
    mockFrom.mockClear();
    ({ inventorySync } = await import('../inventorySync.js'));
  });

  it('deletes the user_inventory row', async () => {
    const pending = [];
    const prevState = { binderSlots: [], binderPanels: [] };
    const nextState = { binderSlots: [], binderPanels: [] };

    inventorySync({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toContainEqual({ table: 'user_inventory', method: 'delete', col: 'id', val: 'inv-1' });
  });

  it('deletes the Supabase row for a slot that was removed entirely — the actual fix, not merely nulled out', async () => {
    const pending = [];
    const prevState = { binderSlots: [makeSlot({ id: 'slot-1', inventoryItemId: 'inv-1' })], binderPanels: [] };
    const nextState = { binderSlots: [], binderPanels: [] }; // slot is gone entirely, matching the real #165 reducer behavior

    inventorySync({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toContainEqual({ table: 'binder_slots', method: 'delete', col: 'id', val: 'slot-1' });
  });

  it('does NOT touch a slot that still exists (was not the one linked to this copy)', async () => {
    const pending = [];
    const otherSlot = makeSlot({ id: 'slot-2', inventoryItemId: 'inv-2' });
    const prevState = { binderSlots: [makeSlot({ id: 'slot-1', inventoryItemId: 'inv-1' }), otherSlot], binderPanels: [] };
    const nextState = { binderSlots: [otherSlot], binderPanels: [] }; // slot-1 removed, slot-2 untouched

    inventorySync({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    const slotDeletes = callLog.filter(c => c.table === 'binder_slots' && c.method === 'delete');
    expect(slotDeletes).toEqual([{ table: 'binder_slots', method: 'delete', col: 'id', val: 'slot-1' }]);
  });

  it('does nothing extra when the copy being removed was never placed anywhere', async () => {
    const pending = [];
    const prevState = { binderSlots: [], binderPanels: [] };
    const nextState = { binderSlots: [], binderPanels: [] };

    inventorySync({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    const slotDeletes = callLog.filter(c => c.table === 'binder_slots');
    expect(slotDeletes).toEqual([]);
  });

  it('deletes the Supabase row for a card-type panel that was removed entirely, same fix as plain slots', async () => {
    const pending = [];
    const panel = { id: 'panel-1', panelType: 'card', inventoryItemId: 'inv-1' };
    const prevState = { binderSlots: [], binderPanels: [panel] };
    const nextState = { binderSlots: [], binderPanels: [] };

    inventorySync({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState, pending);
    await Promise.all(pending);

    expect(callLog).toContainEqual({ table: 'binder_panels', method: 'delete', col: 'id', val: 'panel-1' });
  });
});

describe('inventorySync — INVENTORY_BULK_DELETE', () => {
  let inventorySync;

  beforeEach(async () => {
    callLog.length = 0;
    mockFrom.mockClear();
    ({ inventorySync } = await import('../inventorySync.js'));
  });

  it('deletes every removed slot\'s Supabase row across multiple deleted copies', async () => {
    const pending = [];
    const prevState = {
      binderSlots: [makeSlot({ id: 'slot-1', inventoryItemId: 'inv-1' }), makeSlot({ id: 'slot-2', inventoryItemId: 'inv-2' })],
      binderPanels: [],
    };
    const nextState = { binderSlots: [], binderPanels: [] }; // both removed entirely

    inventorySync({ type: ACTIONS.INVENTORY_BULK_DELETE, payload: { inventoryIds: ['inv-1', 'inv-2'] } }, nextState, prevState, pending);
    await Promise.all(pending);

    const slotDeletes = callLog.filter(c => c.table === 'binder_slots' && c.method === 'delete').map(c => c.val);
    expect(slotDeletes.sort()).toEqual(['slot-1', 'slot-2']);
  });

  it('leaves a slot untouched if it still exists after the bulk delete (wasn\'t linked to any of the removed copies)', async () => {
    const pending = [];
    const survivingSlot = makeSlot({ id: 'slot-3', inventoryItemId: 'inv-3' });
    const prevState = {
      binderSlots: [makeSlot({ id: 'slot-1', inventoryItemId: 'inv-1' }), survivingSlot],
      binderPanels: [],
    };
    const nextState = { binderSlots: [survivingSlot], binderPanels: [] };

    inventorySync({ type: ACTIONS.INVENTORY_BULK_DELETE, payload: { inventoryIds: ['inv-1'] } }, nextState, prevState, pending);
    await Promise.all(pending);

    const slotDeletes = callLog.filter(c => c.table === 'binder_slots' && c.method === 'delete');
    expect(slotDeletes).toEqual([{ table: 'binder_slots', method: 'delete', col: 'id', val: 'slot-1' }]);
  });
});