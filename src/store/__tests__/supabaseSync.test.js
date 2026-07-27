/**
 * @fileoverview Tests for supabaseSync.js's write-routing logic.
 *
 * This file had a real, confirmed bug this session: the slot/panel
 * unlink sync (see reducer.js's INVENTORY_DELETE case) was stale,
 * left over from before the "unlink, don't delete" reducer fix — it
 * looked for a slot that DISAPPEARED (id gone from the array) instead
 * of one that got UPDATED (same id, inventoryItemId cleared to null),
 * meaning the unlink happened locally but never actually reached the
 * database at all.
 *
 * INVENTORY_DELETE itself briefly soft-deleted to a bin.entity_type
 * of 'inventoryItem' (with its own real bug: the database constraint
 * never allowed that value at all) — reverted per explicit request
 * back to a direct, immediate hard delete, since unowning is trivially
 * reversible already. These tests reflect that reverted behavior.
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

describe('INVENTORY_DELETE sync (hard delete, reverted from soft-delete)', () => {
  it('hard-deletes the user_inventory row directly — no bin entry involved', async () => {
    const nextState = baseState({ inventory: [] });
    const prevState = baseState({ inventory: [{ id: 'inv-1', cardDefId: 'card-1' }] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    const inventoryCall = calls.find(c => c.table === 'user_inventory');
    expect(inventoryCall).toBeDefined();
    expect(inventoryCall.ops.some(o => o.op === 'delete')).toBe(true);
    expect(calls.some(c => c.table === 'bin')).toBe(false);
  });

  it('deletes the slot\'s row entirely when it was removed (matches the current reducer behavior — #165 changed this from unlinking to removing outright)', async () => {
    const prevSlot = { id: 'slot-1', inventoryItemId: 'inv-1' };
    // The slot is genuinely ABSENT from nextState now, not merely
    // present with a nulled link — matching what the reducer has
    // actually done since #165.
    const nextState = baseState({ inventory: [], binderSlots: [] });
    const prevState = baseState({ inventory: [{ id: 'inv-1', cardDefId: 'card-1' }], binderSlots: [prevSlot] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    const slotCall = calls.find(c => c.table === 'binder_slots');
    expect(slotCall).toBeDefined();
    expect(slotCall.ops.some(o => o.op === 'delete')).toBe(true);
  });

  it('does not touch binder_slots at all if nothing was unlinked', async () => {
    const nextState = baseState({ inventory: [] });
    const prevState = baseState({ inventory: [{ id: 'inv-1', cardDefId: 'card-1' }] });

    await syncToSupabase({ type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } }, nextState, prevState);

    expect(calls.some(c => c.table === 'binder_slots')).toBe(false);
  });
});

describe('BIN_DELETE_ITEM sync — the real missing-cascade bug', () => {
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