/**
 * @fileoverview Tests for supabaseSync.js's write-routing logic.
 *
 * This file had two real, confirmed bugs this session:
 *   - a database check constraint on bin.entity_type that was never
 *     updated to allow the new 'inventoryItem' type, silently failing
 *     every copy-removal sync with a 400
 *   - BIN_DELETE_ITEM/BIN_EMPTY falling through to a generic,
 *     bin-only cleanup for the inventoryItem type instead of also
 *     deleting the underlying user_inventory row, which would have
 *     left permanently-orphaned rows in the database
 *
 * Testing this requires mocking the Supabase client entirely — the
 * real client throws on import if env vars aren't set, and even with
 * them set this must never hit a real network call. The mock below
 * records every supabase.from(table).<op>(...) call so tests can
 * assert on WHICH tables/operations actually got invoked, without
 * needing real SQL semantics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// === Chainable Supabase mock ===
// Records every call as { table, op, args } so tests can assert on
// what was actually invoked. Every chain method returns `this` so
// arbitrarily long chains (.from().delete().eq().eq()) work, and the
// whole chain is thenable so `await` on it resolves like a real query.
let calls = [];

function makeChain(table) {
  const record = { table, ops: [] };
  const chain = {
    insert:  (...args) => { record.ops.push({ op: 'insert', args }); return chain; },
    update:  (...args) => { record.ops.push({ op: 'update', args }); return chain; },
    upsert:  (...args) => { record.ops.push({ op: 'upsert', args }); return chain; },
    delete:  (...args) => { record.ops.push({ op: 'delete', args }); return chain; },
    select:  (...args) => { record.ops.push({ op: 'select', args }); return chain; },
    eq:      (...args) => { record.ops.push({ op: 'eq', args }); return chain; },
    in:      (...args) => { record.ops.push({ op: 'in', args }); return chain; },
    then: (resolve) => {
      calls.push(record);
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
    catch: () => chain,
  };
  return chain;
}

vi.mock('../../services/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'test-user-1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user-1' } } }),
    },
    from: (table) => makeChain(table),
  },
}));

vi.mock('../../utils/supabaseImageUpload.js', () => ({
  getStoragePathFromUrl: () => null,
  deleteImageFromStorage: () => Promise.resolve(),
}));

const { syncToSupabase } = await import('../supabaseSync.js');
const { ACTIONS } = await import('../reducer.js');

function baseState(overrides = {}) {
  return {
    binders: [], bin: [], collections: [], templateFields: [],
    cardDefinitions: [], inventory: [], binderSlots: [], binderInserts: [], binderPanels: [],
    ...overrides,
  };
}

beforeEach(() => {
  calls = [];
});

describe('INVENTORY_DELETE sync — the real bin.entity_type bug', () => {
  it('upserts to the bin table using entity_type "inventoryItem" for a removed copy', async () => {
    const item = { id: 'inv-1', cardDefId: 'card-1', _type: 'inventoryItem', deletedAt: Date.now(), hadPlacementRemoved: false };
    const nextState = baseState({ bin: [item] });
    const prevState = baseState({ inventory: [{ id: 'inv-1' }] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    const binCall = calls.find(c => c.table === 'bin');
    expect(binCall).toBeDefined();
    const upsertOp = binCall.ops.find(o => o.op === 'upsert');
    expect(upsertOp.args[0].entity_type).toBe('inventoryItem');
  });

  it('also soft-deletes the user_inventory row itself (sets deleted_at), not just the bin snapshot', async () => {
    const item = { id: 'inv-1', cardDefId: 'card-1', _type: 'inventoryItem', deletedAt: Date.now(), hadPlacementRemoved: false };
    const nextState = baseState({ bin: [item] });
    const prevState = baseState({ inventory: [{ id: 'inv-1' }] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    const inventoryCall = calls.find(c => c.table === 'user_inventory');
    expect(inventoryCall).toBeDefined();
    expect(inventoryCall.ops.some(o => o.op === 'update')).toBe(true);
  });

  it('syncs the removed slot/panel unlink when a placement was removed', async () => {
    const item = { id: 'inv-1', cardDefId: 'card-1', _type: 'inventoryItem', deletedAt: Date.now(), hadPlacementRemoved: true };
    const prevSlot = { id: 'slot-1', inventoryItemId: 'inv-1' };
    const nextSlot = { id: 'slot-1', inventoryItemId: null };
    const nextState = baseState({ bin: [item], binderSlots: [nextSlot] });
    const prevState = baseState({ inventory: [{ id: 'inv-1' }], binderSlots: [prevSlot] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    const slotCall = calls.find(c => c.table === 'binder_slots');
    expect(slotCall).toBeDefined();
  });
});

describe('BIN_DELETE_ITEM sync — the real missing-cascade bug', () => {
  it('permanently deleting an inventoryItem bin entry also deletes the underlying user_inventory row (was previously missing entirely)', async () => {
    const binItem = { id: 'inv-1', _type: 'inventoryItem', deletedAt: Date.now() };
    const nextState = baseState({ bin: [] });
    const prevState = baseState({ bin: [binItem] });

    await syncToSupabase({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: 'inv-1' } }, nextState, prevState);

    const inventoryCall = calls.find(c => c.table === 'user_inventory');
    expect(inventoryCall).toBeDefined();
    expect(inventoryCall.ops.some(o => o.op === 'delete')).toBe(true);
    // and the bin row itself is cleaned up too
    const binCall = calls.find(c => c.table === 'bin');
    expect(binCall.ops.some(o => o.op === 'delete')).toBe(true);
  });

  it('permanently deleting a cardDef bin entry cascades to inventory, binder_slots, and card_definitions', async () => {
    const binItem = { id: 'card-1', _type: 'cardDef', deletedAt: Date.now(), image_url: null };
    const nextState = baseState({ bin: [] });
    const prevState = baseState({ bin: [binItem] });

    await syncToSupabase({ type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: 'card-1' } }, nextState, prevState);

    expect(calls.some(c => c.table === 'user_inventory')).toBe(true);
    expect(calls.some(c => c.table === 'binder_slots')).toBe(true);
    expect(calls.some(c => c.table === 'card_definitions')).toBe(true);
  });
});

describe('BINDER_ADD / basic entity sync', () => {
  it('upserts a new binder to the binders table', async () => {
    const binder = { id: 'binder-1', name: 'Test' };
    const nextState = baseState({ binders: [binder] });
    const prevState = baseState();

    await syncToSupabase({ type: ACTIONS.BINDER_ADD, payload: binder }, nextState, prevState);

    const binderCall = calls.find(c => c.table === 'binders');
    expect(binderCall).toBeDefined();
    expect(binderCall.ops.some(o => o.op === 'upsert')).toBe(true);
  });
});

describe('CARD_DEFINITION_DELETE sync', () => {
  it('upserts the bin entry with entity_type "cardDef"', async () => {
    const binItem = { id: 'card-1', _type: 'cardDef', deletedAt: Date.now(), image_url: null };
    const nextState = baseState({ bin: [binItem] });
    const prevState = baseState({ cardDefinitions: [{ id: 'card-1' }] });

    await syncToSupabase({ type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId: 'card-1' } }, nextState, prevState);

    const binCall = calls.find(c => c.table === 'bin');
    expect(binCall).toBeDefined();
    const upsertOp = binCall.ops.find(o => o.op === 'upsert');
    expect(upsertOp.args[0].entity_type).toBe('cardDef');
  });
});