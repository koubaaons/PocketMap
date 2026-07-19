/**
 * @fileoverview Tests for backfillUnlinkedSlots.js.
 *
 * This exists to fix a real, significant bug reported directly by the
 * user: cards genuinely owned were showing as unowned/grey in a
 * binder after every refresh. Root cause: making a binder slot's
 * "is this owned" check strict (only true if linked to a specific,
 * still-existing copy) correctly supports independent copies, but any
 * slot that was never linked at all — overwhelmingly, one placed
 * before per-copy linking existed as a feature — had no way to know
 * it should show as owned. This pairs up unlinked slots/panels with
 * available copies of the same card on every load.
 */

import { describe, it, expect } from 'vitest';
import { backfillUnlinkedSlots } from '../backfillUnlinkedSlots.js';

function makeInv(id, cardDefId) {
  return { id, cardDefId };
}
function makeSlot(id, cardDefId, inventoryItemId = null) {
  return { id, cardDefId, inventoryItemId };
}
function makeCardPanel(id, cardDefId, inventoryItemId = null) {
  return { id, cardDefId, panelType: 'card', inventoryItemId };
}

describe('backfillUnlinkedSlots', () => {
  it('links an unlinked slot to an available copy of the same card — the actual bug fix', () => {
    const inventory = [makeInv('inv-1', 'card-1')];
    const slots = [makeSlot('slot-1', 'card-1', null)];
    const { binderSlots } = backfillUnlinkedSlots(inventory, slots, []);
    expect(binderSlots[0].inventoryItemId).toBe('inv-1');
  });

  it('links an unlinked card-type panel too', () => {
    const inventory = [makeInv('inv-1', 'card-1')];
    const panels = [makeCardPanel('panel-1', 'card-1', null)];
    const { binderPanels } = backfillUnlinkedSlots(inventory, [], panels);
    expect(binderPanels[0].inventoryItemId).toBe('inv-1');
  });

  it('never touches an insert-type panel (not a real card, no copy to link)', () => {
    const inventory = [makeInv('inv-1', 'card-1')];
    const panels = [{ id: 'panel-1', cardDefId: null, panelType: 'insert', inventoryItemId: null }];
    const { binderPanels } = backfillUnlinkedSlots(inventory, [], panels);
    expect(binderPanels[0].inventoryItemId).toBeNull();
  });

  it('does not touch a slot already linked to a real, existing copy', () => {
    const inventory = [makeInv('inv-1', 'card-1')];
    const slots = [makeSlot('slot-1', 'card-1', 'inv-1')];
    const { binderSlots } = backfillUnlinkedSlots(inventory, slots, []);
    expect(binderSlots[0].inventoryItemId).toBe('inv-1'); // unchanged
  });

  it('leaves an unlinked slot alone if no copy is actually owned for that card', () => {
    const slots = [makeSlot('slot-1', 'card-1', null)];
    const { binderSlots } = backfillUnlinkedSlots([], slots, []);
    expect(binderSlots[0].inventoryItemId).toBeNull();
  });

  it('never assigns the same copy to two different slots', () => {
    const inventory = [makeInv('inv-1', 'card-1')]; // only ONE copy
    const slots = [
      makeSlot('slot-1', 'card-1', null),
      makeSlot('slot-2', 'card-1', null),
    ];
    const { binderSlots } = backfillUnlinkedSlots(inventory, slots, []);
    const linkedCount = binderSlots.filter(s => s.inventoryItemId === 'inv-1').length;
    expect(linkedCount).toBe(1); // only one slot claims it, the other stays unlinked
  });

  it('with multiple copies and multiple unlinked slots, pairs them up one-to-one', () => {
    const inventory = [makeInv('inv-1', 'card-1'), makeInv('inv-2', 'card-1')];
    const slots = [
      makeSlot('slot-1', 'card-1', null),
      makeSlot('slot-2', 'card-1', null),
    ];
    const { binderSlots } = backfillUnlinkedSlots(inventory, slots, []);
    const linkedIds = binderSlots.map(s => s.inventoryItemId).sort();
    expect(linkedIds).toEqual(['inv-1', 'inv-2']);
  });

  it('does not let an already-linked slot "steal" a copy meant for backfilling elsewhere', () => {
    const inventory = [makeInv('inv-1', 'card-1'), makeInv('inv-2', 'card-1')];
    const slots = [
      makeSlot('slot-1', 'card-1', 'inv-1'), // already linked
      makeSlot('slot-2', 'card-1', null),    // needs backfilling
    ];
    const { binderSlots } = backfillUnlinkedSlots(inventory, slots, []);
    const slot2 = binderSlots.find(s => s.id === 'slot-2');
    expect(slot2.inventoryItemId).toBe('inv-2'); // gets the OTHER copy, not inv-1
  });

  it('is a no-op when there is nothing to backfill', () => {
    const inventory = [makeInv('inv-1', 'card-1')];
    const slots = [makeSlot('slot-1', 'card-1', 'inv-1')];
    const panels = [makeCardPanel('panel-1', 'card-2', null)]; // different card, no copies owned
    const { binderSlots, binderPanels } = backfillUnlinkedSlots(inventory, slots, panels);
    expect(binderSlots[0].inventoryItemId).toBe('inv-1');
    expect(binderPanels[0].inventoryItemId).toBeNull();
  });
});