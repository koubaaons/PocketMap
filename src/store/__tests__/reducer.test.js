/**
 * @fileoverview Reducer tests for the three actions that actually
 * caused real, user-facing bugs this session:
 *
 *   BINDER_SLOT_ADD — regressed twice: once by requiring an owned
 *     copy before ANY placement was allowed (breaking unowned/grey
 *     placeholder cards entirely), and generally around the
 *     quantity-limit logic itself.
 *   INVENTORY_DELETE — deleted a card's linked slot outright instead
 *     of just unlinking it, making an unowned card vanish from its
 *     binder instead of greying out (the single worst bug this
 *     session, reported directly by the user).
 *   BIN_RESTORE_INVENTORY_ITEM — needed to match INVENTORY_DELETE's
 *     fix: re-link the still-existing slot, not "re-add" one that
 *     was never actually removed.
 *
 * These three are deliberately the most heavily tested files in this
 * whole suite — this is where the damage actually happened.
 */

import { describe, it, expect } from 'vitest';
import { reducer, ACTIONS } from '../reducer.js';

function baseState(overrides = {}) {
  return {
    version: 2,
    user: { id: 'user-1', username: 'Tester', createdAt: 0 },
    nav: { currentView: 'home', currentBinderId: null, currentCollectionId: null, currentPage: 1 },
    binders: [{ id: 'binder-1', userId: 'user-1', name: 'Test Binder', rows: 3, cols: 3, pages: 10, cover_color: '#000', page_color: '#111', stickers: [], createdAt: 0, updatedAt: 0 }],
    bin: [],
    collections: [{ id: 'coll-1', userId: 'user-1', name: 'Test Collection', is_custom: true, import_source: null, cover_image_url: null, createdAt: 0, updatedAt: 0 }],
    templateFields: [],
    cardDefinitions: [{ id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', image_url: null, attributes: {}, holoType: 'none', rarity: null, createdAt: 0, updatedAt: 0 }],
    inventory: [],
    binderSlots: [],
    binderInserts: [],
    binderPanels: [],
    ...overrides,
  };
}

function makeInventoryItem(id, overrides = {}) {
  return {
    id, userId: 'user-1', cardDefId: 'card-1', collectionId: 'coll-1',
    condition_rating: null, language: null, is_tradeable: false, is_sellable: false,
    is_favorite: false, personal_notes: null, acquired_at: null,
    createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

function makeSlotPayload(overrides = {}) {
  return {
    id: 'slot-new', userId: 'user-1', binderId: 'binder-1', cardDefId: 'card-1',
    collectionId: 'coll-1', pageNumber: 1, slotIndex: 0, inventoryItemId: null,
    createdAt: 0,
    ...overrides,
  };
}

function makePanelForBinderTest(overrides = {}) {
  return {
    id: 'panel-1', userId: 'user-1', binderId: 'binder-1',
    pageNumber: 1, startSlotIndex: 4, spanCols: 2, spanRows: 1,
    panelType: 'card', cardDefId: 'card-1', insertId: null,
    inventoryItemId: null, imageX: 50, imageY: 50, imageScale: 1,
    createdAt: 0,
    ...overrides,
  };
}

describe('BINDER_SLOT_ADD', () => {
  it('places an unowned card as a grey placeholder (0 copies owned) — the regression that broke this entirely', () => {
    const state = baseState({ inventory: [] }); // owns nothing
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload() } });
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].inventoryItemId).toBeNull();
  });

  it('rejects placing the same unowned card twice in the same binder', () => {
    let state = baseState({ inventory: [] });
    state = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-a', slotIndex: 0 }) } });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-b', slotIndex: 1 }) } });
    expect(next.binderSlots).toHaveLength(1); // second placement rejected
  });

  it('places an owned card and links it to a specific unplaced copy', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1')] });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload() } });
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].inventoryItemId).toBe('inv-1');
  });

  it('allows placing the SAME card more than once when multiple copies are owned', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2')] });
    let next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-a', slotIndex: 0 }) } });
    next = reducer(next, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-b', slotIndex: 1 }) } });
    expect(next.binderSlots).toHaveLength(2);
    // each linked to a DIFFERENT copy
    const linkedIds = next.binderSlots.map(s => s.inventoryItemId).sort();
    expect(linkedIds).toEqual(['inv-1', 'inv-2']);
  });

  it('rejects placing an owned card once every copy is already placed', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      binderSlots: [makeSlotPayload({ id: 'slot-existing', slotIndex: 0, inventoryItemId: 'inv-1' })],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-new', slotIndex: 1 }) } });
    expect(next.binderSlots).toHaveLength(1); // unchanged, new placement rejected
  });

  it('rejects placing into an already-occupied position (card still exists)', () => {
    const state = baseState({
      binderSlots: [makeSlotPayload({ id: 'slot-existing', slotIndex: 0 })],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_ADD, payload: { slot: makeSlotPayload({ id: 'slot-new', slotIndex: 0 }) } });
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].id).toBe('slot-existing'); // original untouched
  });

  describe('explicit copy choice (user picked a specific copy via the Add Card modal)', () => {
    it('links the new slot to exactly the requested copy, not whichever comes first', () => {
      const state = baseState({ inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2')] });
      const next = reducer(state, {
        type: ACTIONS.BINDER_SLOT_ADD,
        payload: { slot: makeSlotPayload({ inventoryItemId: 'inv-2' }) },
      });
      expect(next.binderSlots[0].inventoryItemId).toBe('inv-2');
    });

    it('rejects a requested copy that does not belong to this card', () => {
      const state = baseState({
        inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-other', { cardDefId: 'card-2' })],
      });
      const next = reducer(state, {
        type: ACTIONS.BINDER_SLOT_ADD,
        payload: { slot: makeSlotPayload({ inventoryItemId: 'inv-other' }) },
      });
      expect(next.binderSlots).toHaveLength(0);
    });

    it('rejects a requested copy that is already placed elsewhere', () => {
      const state = baseState({
        inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2')],
        binderSlots: [makeSlotPayload({ id: 'slot-existing', slotIndex: 0, inventoryItemId: 'inv-2' })],
      });
      const next = reducer(state, {
        type: ACTIONS.BINDER_SLOT_ADD,
        payload: { slot: makeSlotPayload({ id: 'slot-new', slotIndex: 1, inventoryItemId: 'inv-2' }) },
      });
      expect(next.binderSlots).toHaveLength(1); // only the original
    });

    it('rejects a requested copy id that does not exist at all', () => {
      const state = baseState({ inventory: [makeInventoryItem('inv-1')] });
      const next = reducer(state, {
        type: ACTIONS.BINDER_SLOT_ADD,
        payload: { slot: makeSlotPayload({ inventoryItemId: 'does-not-exist' }) },
      });
      expect(next.binderSlots).toHaveLength(0);
    });
  });

  it('replaces an orphaned slot (card no longer exists) instead of blocking the new placement', () => {
    const state = baseState({
      cardDefinitions: [], // card-1 no longer exists
      binderSlots: [makeSlotPayload({ id: 'slot-orphan', slotIndex: 0, cardDefId: 'card-1' })],
    });
    // re-add cardDefinitions so the NEW slot's card exists, but the orphan slot referenced a since-deleted one
    const stateWithNewCard = { ...state, cardDefinitions: [{ id: 'card-2', collectionId: 'coll-1', name: 'Bulbasaur', attributes: {}, createdAt: 0, updatedAt: 0 }] };
    const next = reducer(stateWithNewCard, {
      type: ACTIONS.BINDER_SLOT_ADD,
      payload: { slot: makeSlotPayload({ id: 'slot-replacement', slotIndex: 0, cardDefId: 'card-2' }) },
    });
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].id).toBe('slot-replacement');
  });
});

describe('INVENTORY_DELETE (hard delete - reverted from soft-delete per explicit request)', () => {
  it('removing a copy linked to a slot UNLINKS it, never deletes the slot — still the most important fix here', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: 'inv-1' })],
    });
    const next = reducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } });

    expect(next.inventory).toHaveLength(0);
    // the slot must still exist — this is the whole point of the fix
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].id).toBe('slot-1');
    expect(next.binderSlots[0].inventoryItemId).toBeNull(); // unlinked, now shows as a grey placeholder
  });

  it('removes the item permanently — no bin entry created (reverted from soft-delete)', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: 'inv-1' })],
    });
    const next = reducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } });
    expect(next.bin).toHaveLength(0);
  });

  it('removing an unplaced copy does not touch any slots', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1')], binderSlots: [] });
    const next = reducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } });
    expect(next.binderSlots).toHaveLength(0);
  });

  it('removing one of several copies only unlinks the one actually linked to it, not any other slot', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2')],
      binderSlots: [
        makeSlotPayload({ id: 'slot-1', slotIndex: 0, inventoryItemId: 'inv-1' }),
        makeSlotPayload({ id: 'slot-2', slotIndex: 1, inventoryItemId: 'inv-2' }),
      ],
    });
    const next = reducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'inv-1' } });
    const slot1 = next.binderSlots.find(s => s.id === 'slot-1');
    const slot2 = next.binderSlots.find(s => s.id === 'slot-2');
    expect(slot1.inventoryItemId).toBeNull(); // unlinked
    expect(slot2.inventoryItemId).toBe('inv-2'); // untouched
  });

  it('does nothing if the inventory item does not exist', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1')] });
    const next = reducer(state, { type: ACTIONS.INVENTORY_DELETE, payload: { inventoryId: 'does-not-exist' } });
    expect(next).toBe(state); // unchanged reference
  });
});

describe('BINDER_SLOT_UPDATE', () => {
  it('links a slot to a specific inventory item', () => {
    const state = baseState({ binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: null })] });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_UPDATE, payload: { slotId: 'slot-1', inventoryItemId: 'inv-1' } });
    expect(next.binderSlots[0].inventoryItemId).toBe('inv-1');
  });

  it('can unlink a slot by passing null', () => {
    const state = baseState({ binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: 'inv-1' })] });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_UPDATE, payload: { slotId: 'slot-1', inventoryItemId: null } });
    expect(next.binderSlots[0].inventoryItemId).toBeNull();
  });

  it('only affects the targeted slot, not others for the same card', () => {
    const state = baseState({
      binderSlots: [
        makeSlotPayload({ id: 'slot-1', slotIndex: 0, inventoryItemId: null }),
        makeSlotPayload({ id: 'slot-2', slotIndex: 1, inventoryItemId: null }),
      ],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_UPDATE, payload: { slotId: 'slot-1', inventoryItemId: 'inv-1' } });
    expect(next.binderSlots.find(s => s.id === 'slot-1').inventoryItemId).toBe('inv-1');
    expect(next.binderSlots.find(s => s.id === 'slot-2').inventoryItemId).toBeNull();
  });
});

describe('INVENTORY_ADD', () => {
  it('adds a new inventory row without rejecting an existing one for the same card (multiple copies)', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1')] });
    const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: makeInventoryItem('inv-2') });
    expect(next.inventory).toHaveLength(2);
  });

  describe('auto-linking an unowned placeholder slot (fix for the real "Collection and binder are disconnected" bug)', () => {
    it('links a newly-owned copy to an existing, unlinked placeholder slot for the same card', () => {
      const state = baseState({
        inventory: [],
        binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: null })], // grey placeholder
      });
      const newItem = makeInventoryItem('inv-1');
      const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: newItem });
      expect(next.binderSlots[0].inventoryItemId).toBe('inv-1');
    });

    it('links to an existing, unlinked card-type panel too, if no plain slot is unlinked', () => {
      const state = baseState({
        inventory: [],
        binderPanels: [{ id: 'panel-1', binderId: 'binder-1', panelType: 'card', cardDefId: 'card-1', inventoryItemId: null, spanCols: 2, spanRows: 1, pageNumber: 1, startSlotIndex: 0, imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 }],
      });
      const newItem = makeInventoryItem('inv-1');
      const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: newItem });
      expect(next.binderPanels[0].inventoryItemId).toBe('inv-1');
    });

    it('does nothing extra if no unlinked slot/panel exists for this card', () => {
      const state = baseState({ inventory: [] });
      const newItem = makeInventoryItem('inv-1');
      const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: newItem });
      expect(next.binderSlots).toHaveLength(0);
      expect(next.inventory).toHaveLength(1);
    });

    it('only links ONE slot per new copy, not every unlinked slot for the card', () => {
      const state = baseState({
        inventory: [],
        binderSlots: [
          makeSlotPayload({ id: 'slot-1', slotIndex: 0, inventoryItemId: null }),
          makeSlotPayload({ id: 'slot-2', slotIndex: 1, inventoryItemId: null }),
        ],
      });
      const newItem = makeInventoryItem('inv-1');
      const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: newItem });
      const linkedCount = next.binderSlots.filter(s => s.inventoryItemId === 'inv-1').length;
      expect(linkedCount).toBe(1);
    });

    it('does not touch a slot already linked to a different, existing copy', () => {
      const state = baseState({
        inventory: [makeInventoryItem('inv-existing')],
        binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: 'inv-existing' })],
      });
      const newItem = makeInventoryItem('inv-new');
      const next = reducer(state, { type: ACTIONS.INVENTORY_ADD, payload: newItem });
      expect(next.binderSlots[0].inventoryItemId).toBe('inv-existing'); // untouched
    });
  });
});

describe('BINDER_PANEL_ADD (Michi Method combined slots)', () => {  function makePanelPayload(overrides = {}) {
    return {
      id: 'panel-new', userId: 'user-1', binderId: 'binder-1',
      pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1,
      panelType: 'card', cardDefId: 'card-1', insertId: null,
      inventoryItemId: null, imageX: 50, imageY: 50, imageScale: 1,
      createdAt: 0,
      ...overrides,
    };
  }

  it('places an insert-type panel (never card-related, no quantity concept applies)', () => {
    const state = baseState();
    const next = reducer(state, {
      type: ACTIONS.BINDER_PANEL_ADD,
      payload: makePanelPayload({ panelType: 'insert', cardDefId: null, insertId: 'insert-1' }),
    });
    expect(next.binderPanels).toHaveLength(1);
  });

  it('places a card-type panel for an OWNED card and links it to a specific copy', () => {
    const state = baseState({ inventory: [makeInventoryItem('inv-1')] });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_ADD, payload: makePanelPayload() });
    expect(next.binderPanels).toHaveLength(1);
    expect(next.binderPanels[0].inventoryItemId).toBe('inv-1');
  });

  it('places a card-type panel for an UNOWNED card as a grey placeholder (same fix BINDER_SLOT_ADD needed)', () => {
    const state = baseState({ inventory: [] }); // owns nothing
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_ADD, payload: makePanelPayload() });
    expect(next.binderPanels).toHaveLength(1);
    expect(next.binderPanels[0].inventoryItemId).toBeNull();
  });

  it('rejects a card-type panel once every copy is already placed elsewhere', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      binderSlots: [makeSlotPayload({ id: 'slot-existing', inventoryItemId: 'inv-1' })],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_ADD, payload: makePanelPayload() });
    expect(next.binderPanels).toHaveLength(0);
  });

  it('rejects overlapping an existing normal slot in the span', () => {
    const state = baseState({
      binderSlots: [makeSlotPayload({ id: 'slot-in-the-way', slotIndex: 1 })], // within the panel's 2-wide span starting at 0
    });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_ADD, payload: makePanelPayload() });
    expect(next.binderPanels).toHaveLength(0);
  });

  it('rejects overlapping an existing panel', () => {
    const state = baseState({
      binderPanels: [makePanelPayload({ id: 'panel-existing', startSlotIndex: 0, spanCols: 2 })],
    });
    const next = reducer(state, {
      type: ACTIONS.BINDER_PANEL_ADD,
      payload: makePanelPayload({ id: 'panel-overlap', startSlotIndex: 1, spanCols: 2 }),
    });
    expect(next.binderPanels).toHaveLength(1); // still just the original
  });

  it('rejects if the binder does not exist', () => {
    const state = baseState({ binders: [] });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_ADD, payload: makePanelPayload() });
    expect(next.binderPanels).toHaveLength(0);
  });
});

describe('CARD_DEFINITION_DELETE', () => {
  it('moves the card to bin and removes its inventory/slots/panels from active state', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      binderSlots: [makeSlotPayload({ id: 'slot-1', inventoryItemId: 'inv-1' })],
    });
    const next = reducer(state, { type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId: 'card-1' } });
    expect(next.cardDefinitions).toHaveLength(0);
    expect(next.inventory).toHaveLength(0);
    expect(next.binderSlots).toHaveLength(0);
    expect(next.bin).toHaveLength(1);
    expect(next.bin[0]._type).toBe('cardDef');
  });

  it('preserves EVERY owned copy in the bin snapshot, not just one — real bug found while writing this test', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2'), makeInventoryItem('inv-3')],
    });
    const next = reducer(state, { type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId: 'card-1' } });
    expect(next.inventory).toHaveLength(0); // all removed from active state
    const binItem = next.bin[0];
    // the actual bug: this used to be `_inventoryItem` (singular, .find())
    // capturing only ONE of the three copies before wiping all three out —
    // meaning restoring the card afterward would silently lose 2 of 3 copies forever.
    expect(binItem._inventoryItems).toBeDefined();
    expect(binItem._inventoryItems).toHaveLength(3);
  });

  it('does nothing if the card does not exist', () => {
    const state = baseState();
    const next = reducer(state, { type: ACTIONS.CARD_DEFINITION_DELETE, payload: { cardDefId: 'does-not-exist' } });
    expect(next).toBe(state);
  });
});

describe('BIN_RESTORE_CARD', () => {
  it('restores the card and ALL of its owned copies, not just one', () => {
    const state = baseState({ cardDefinitions: [], inventory: [] });
    const binItem = {
      id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0,
      _type: 'cardDef', deletedAt: 0,
      _inventoryItems: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2'), makeInventoryItem('inv-3')],
    };
    const next = reducer({ ...state, bin: [binItem] }, { type: ACTIONS.BIN_RESTORE_CARD, payload: { itemId: 'card-1' } });
    expect(next.cardDefinitions).toHaveLength(1);
    expect(next.inventory).toHaveLength(3);
    expect(next.bin).toHaveLength(0);
  });

  it('restores a card that had zero owned copies without error', () => {
    const state = baseState({ cardDefinitions: [], inventory: [] });
    const binItem = {
      id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0,
      _type: 'cardDef', deletedAt: 0, _inventoryItems: [],
    };
    const next = reducer({ ...state, bin: [binItem] }, { type: ACTIONS.BIN_RESTORE_CARD, payload: { itemId: 'card-1' } });
    expect(next.cardDefinitions).toHaveLength(1);
    expect(next.inventory).toHaveLength(0);
  });

  it('does nothing if the bin item does not exist', () => {
    const state = baseState({ bin: [] });
    const next = reducer(state, { type: ACTIONS.BIN_RESTORE_CARD, payload: { itemId: 'does-not-exist' } });
    expect(next).toBe(state);
  });
});

describe('BINDER_DELETE / BIN_RESTORE_BINDER', () => {
  it('soft-deletes a binder and cascades to its slots and panels', () => {
    const state = baseState({
      binderSlots: [makeSlotPayload()],
      binderPanels: [makePanelForBinderTest()],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_DELETE, payload: { binderId: 'binder-1' } });
    expect(next.binders).toHaveLength(0);
    expect(next.binderSlots).toHaveLength(0);
    expect(next.binderPanels).toHaveLength(0);
    expect(next.bin).toHaveLength(1);
    expect(next.bin[0]._type).toBe('binder');
  });

  it('does not touch slots/panels belonging to a DIFFERENT binder', () => {
    const state = baseState({
      binders: [
        { id: 'binder-1', userId: 'user-1', name: 'A', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: '#111', stickers: [], createdAt: 0, updatedAt: 0 },
        { id: 'binder-2', userId: 'user-1', name: 'B', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: '#111', stickers: [], createdAt: 0, updatedAt: 0 },
      ],
      binderSlots: [makeSlotPayload({ id: 'slot-other', binderId: 'binder-2' })],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_DELETE, payload: { binderId: 'binder-1' } });
    expect(next.binderSlots).toHaveLength(1); // binder-2's slot untouched
  });

  it('restores a binder from bin', () => {
    const state = baseState({ binders: [] });
    const binItem = { id: 'binder-1', userId: 'user-1', name: 'A', rows: 3, cols: 3, pages: 5, cover_color: '#000', page_color: '#111', stickers: [], createdAt: 0, updatedAt: 0, _type: 'binder', deletedAt: 0 };
    const next = reducer({ ...state, bin: [binItem] }, { type: ACTIONS.BIN_RESTORE_BINDER, payload: { itemId: 'binder-1' } });
    expect(next.binders).toHaveLength(1);
    expect(next.bin).toHaveLength(0);
  });
});

describe('COLLECTION_DELETE / BIN_RESTORE_COLLECTION', () => {
  it('cascades to cards, template fields, inventory, and binder slots/panels within it', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1')],
      templateFields: [{ id: 'field-1', collectionId: 'coll-1', field_name: 'Rarity', field_type: 'text', is_required: false, order: 0 }],
      binderSlots: [makeSlotPayload({ collectionId: 'coll-1' })],
    });
    const next = reducer(state, { type: ACTIONS.COLLECTION_DELETE, payload: { collectionId: 'coll-1' } });
    expect(next.collections).toHaveLength(0);
    expect(next.cardDefinitions).toHaveLength(0);
    expect(next.templateFields).toHaveLength(0);
    expect(next.inventory).toHaveLength(0);
    expect(next.binderSlots).toHaveLength(0);
    expect(next.bin).toHaveLength(1);
  });

  it('preserves every affected card AND every affected inventory item (all copies) in the bin snapshot', () => {
    const state = baseState({
      cardDefinitions: [
        { id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0 },
        { id: 'card-2', collectionId: 'coll-1', name: 'Raichu', attributes: {}, createdAt: 0, updatedAt: 0 },
      ],
      inventory: [makeInventoryItem('inv-1', { cardDefId: 'card-1' }), makeInventoryItem('inv-2', { cardDefId: 'card-1' }), makeInventoryItem('inv-3', { cardDefId: 'card-2' })],
    });
    const next = reducer(state, { type: ACTIONS.COLLECTION_DELETE, payload: { collectionId: 'coll-1' } });
    const binItem = next.bin[0];
    expect(binItem._cardDefs).toHaveLength(2);
    expect(binItem._inventoryItems).toHaveLength(3); // both copies of card-1 AND card-2's copy
  });

  it('restores a collection with all its cards, fields, and inventory', () => {
    const state = baseState({ collections: [], cardDefinitions: [], templateFields: [], inventory: [] });
    const binItem = {
      id: 'coll-1', userId: 'user-1', name: 'Test Collection', is_custom: true, import_source: null, cover_image_url: null, createdAt: 0, updatedAt: 0,
      _type: 'collection', deletedAt: 0,
      _cardDefs: [{ id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0 }],
      _templateFields: [{ id: 'field-1', collectionId: 'coll-1', field_name: 'Rarity', field_type: 'text', is_required: false, order: 0 }],
      _inventoryItems: [makeInventoryItem('inv-1')],
    };
    const next = reducer({ ...state, bin: [binItem] }, { type: ACTIONS.BIN_RESTORE_COLLECTION, payload: { itemId: 'coll-1' } });
    expect(next.collections).toHaveLength(1);
    expect(next.cardDefinitions).toHaveLength(1);
    expect(next.templateFields).toHaveLength(1);
    expect(next.inventory).toHaveLength(1);
  });
});

describe('BIN_DELETE_ITEM (permanent delete)', () => {
  it('permanently deleting a cardDef bin item also removes its cascaded inventory/slots/panels', () => {
    const state = baseState({
      inventory: [],
      binderSlots: [],
      bin: [{ id: 'card-1', _type: 'cardDef', deletedAt: 0, collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0 }],
      // simulate leftover local rows that should be cleaned up on PERMANENT delete
      cardDefinitions: [{ id: 'card-1', collectionId: 'coll-1', name: 'Pikachu', attributes: {}, createdAt: 0, updatedAt: 0 }],
    });
    const next = reducer(state, { type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: 'card-1' } });
    expect(next.bin).toHaveLength(0);
    expect(next.cardDefinitions).toHaveLength(0);
  });

  it('falls back to a bin-only removal for an unknown _type rather than throwing', () => {
    const state = baseState({ bin: [{ id: 'weird-1', _type: 'inventoryItem', deletedAt: 0 }] });
    const next = reducer(state, { type: ACTIONS.BIN_DELETE_ITEM, payload: { itemId: 'weird-1' } });
    expect(next.bin).toHaveLength(0);
  });
});

describe('BIN_EMPTY', () => {
  it('clears the entire bin', () => {
    const state = baseState({ bin: [{ id: 'x', _type: 'binder', deletedAt: 0 }, { id: 'y', _type: 'cardDef', deletedAt: 0 }] });
    const next = reducer(state, { type: ACTIONS.BIN_EMPTY });
    expect(next.bin).toHaveLength(0);
  });
});

describe('simple CRUD actions', () => {
  it('BINDER_ADD appends a new binder', () => {
    const state = baseState({ binders: [] });
    const newBinder = { id: 'binder-2', name: 'New Binder' };
    const next = reducer(state, { type: ACTIONS.BINDER_ADD, payload: newBinder });
    expect(next.binders).toHaveLength(1);
  });

  it('BINDER_UPDATE merges changes into the matching binder only', () => {
    const state = baseState();
    const next = reducer(state, { type: ACTIONS.BINDER_UPDATE, payload: { id: 'binder-1', name: 'Renamed' } });
    expect(next.binders[0].name).toBe('Renamed');
  });

  it('COLLECTION_ADD appends a new collection', () => {
    const state = baseState({ collections: [] });
    const next = reducer(state, { type: ACTIONS.COLLECTION_ADD, payload: { id: 'coll-2', name: 'New Collection' } });
    expect(next.collections).toHaveLength(1);
  });

  it('COLLECTION_UPDATE merges changes and bumps updatedAt', () => {
    const state = baseState();
    const next = reducer(state, { type: ACTIONS.COLLECTION_UPDATE, payload: { id: 'coll-1', name: 'Renamed' } });
    expect(next.collections[0].name).toBe('Renamed');
    expect(next.collections[0].updatedAt).toBeGreaterThan(0);
  });

  it('CARD_DEFINITION_ADD appends a new card', () => {
    const state = baseState({ cardDefinitions: [] });
    const next = reducer(state, { type: ACTIONS.CARD_DEFINITION_ADD, payload: { id: 'card-2', name: 'New Card' } });
    expect(next.cardDefinitions).toHaveLength(1);
  });

  it('CARD_DEFINITION_UPDATE merges changes into only the matching card', () => {
    const state = baseState({
      cardDefinitions: [
        { id: 'card-1', name: 'Original', collectionId: 'coll-1', attributes: {}, createdAt: 0, updatedAt: 0 },
        { id: 'card-2', name: 'Untouched', collectionId: 'coll-1', attributes: {}, createdAt: 0, updatedAt: 0 },
      ],
    });
    const next = reducer(state, { type: ACTIONS.CARD_DEFINITION_UPDATE, payload: { id: 'card-1', name: 'Renamed' } });
    expect(next.cardDefinitions.find(cd => cd.id === 'card-1').name).toBe('Renamed');
    expect(next.cardDefinitions.find(cd => cd.id === 'card-2').name).toBe('Untouched');
  });

  it('INVENTORY_UPDATE merges changes (e.g. adding language/condition) into only the matching copy', () => {
    const state = baseState({
      inventory: [makeInventoryItem('inv-1'), makeInventoryItem('inv-2')],
    });
    const next = reducer(state, { type: ACTIONS.INVENTORY_UPDATE, payload: { id: 'inv-1', language: 'japanese', condition_rating: 'mint' } });
    const updated = next.inventory.find(i => i.id === 'inv-1');
    const untouched = next.inventory.find(i => i.id === 'inv-2');
    expect(updated.language).toBe('japanese');
    expect(updated.condition_rating).toBe('mint');
    expect(untouched.language).toBeNull();
  });

  it('BINDER_INSERT_ADD appends a new insert', () => {
    const state = baseState({ binderInserts: [] });
    const next = reducer(state, { type: ACTIONS.BINDER_INSERT_ADD, payload: { id: 'insert-1', name: 'Art' } });
    expect(next.binderInserts).toHaveLength(1);
  });

  it('BINDER_INSERT_DELETE removes the insert AND any panel using it (would otherwise be a broken image reference)', () => {
    const state = baseState({
      binderInserts: [{ id: 'insert-1', name: 'Art' }],
      binderPanels: [
        { id: 'panel-1', binderId: 'binder-1', panelType: 'insert', insertId: 'insert-1', cardDefId: null, pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 },
        { id: 'panel-2', binderId: 'binder-1', panelType: 'insert', insertId: 'other-insert', cardDefId: null, pageNumber: 1, startSlotIndex: 4, spanCols: 2, spanRows: 1, imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 },
      ],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_INSERT_DELETE, payload: { insertId: 'insert-1' } });
    expect(next.binderInserts).toHaveLength(0);
    expect(next.binderPanels).toHaveLength(1); // only panel-2 (using a different insert) survives
    expect(next.binderPanels[0].id).toBe('panel-2');
  });

  it('BINDER_PANEL_UPDATE merges changes (e.g. drag/resize position) into the matching panel', () => {
    const state = baseState({
      binderPanels: [{ id: 'panel-1', binderId: 'binder-1', panelType: 'card', cardDefId: 'card-1', inventoryItemId: null, pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 }],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_UPDATE, payload: { id: 'panel-1', imageX: 75, imageScale: 1.5 } });
    expect(next.binderPanels[0].imageX).toBe(75);
    expect(next.binderPanels[0].imageScale).toBe(1.5);
  });

  it('BINDER_PANEL_REMOVE removes the panel, returning its slots to normal (nothing else needs cleanup)', () => {
    const state = baseState({
      binderPanels: [{ id: 'panel-1', binderId: 'binder-1', panelType: 'card', cardDefId: 'card-1', inventoryItemId: 'inv-1', pageNumber: 1, startSlotIndex: 0, spanCols: 2, spanRows: 1, imageX: 50, imageY: 50, imageScale: 1, createdAt: 0 }],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_PANEL_REMOVE, payload: { panelId: 'panel-1' } });
    expect(next.binderPanels).toHaveLength(0);
  });

  it('BINDER_SLOT_REMOVE removes just the targeted slot', () => {
    const state = baseState({
      binderSlots: [makeSlotPayload({ id: 'slot-1' }), makeSlotPayload({ id: 'slot-2', slotIndex: 1 })],
    });
    const next = reducer(state, { type: ACTIONS.BINDER_SLOT_REMOVE, payload: { slotId: 'slot-1' } });
    expect(next.binderSlots).toHaveLength(1);
    expect(next.binderSlots[0].id).toBe('slot-2');
  });
});