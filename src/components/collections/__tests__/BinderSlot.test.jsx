// @vitest-environment jsdom
/**
 * @fileoverview Tests for BinderSlot.jsx.
 *
 * Focused specifically on the new drag-to-reposition feature —
 * requested directly: dragging an already-placed card to move it to
 * a new slot didn't exist in either mode before this. Not attempting
 * broader coverage of the rest of this file's rendering logic here.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinderSlot } from '../BinderSlot.jsx';

const SLOT = { id: 'slot-1', binderId: 'binder-1', pageNumber: 1, slotIndex: 0, cardDefId: 'card-1' };
const CARD_DEF = { id: 'card-1', name: 'Pikachu', image_url: null };

function makeDataTransfer(payload) {
  const store = {};
  return {
    setData: (type, value) => { store[type] = value; },
    getData: (type) => store[type] ?? (payload !== undefined ? JSON.stringify(payload) : ''),
    dropEffect: null,
    effectAllowed: null,
  };
}

describe('BinderSlot — drag-to-reposition (real feature)', () => {
  it('a filled slot is draggable when onMoveSlotHere is provided', () => {
    render(
      <BinderSlot slotIndex={0} slot={SLOT} cardDef={CARD_DEF} onClickSlot={() => {}} onMoveSlotHere={() => {}} />
    );

    expect(screen.getByLabelText('Pikachu')).toHaveAttribute('draggable', 'true');
  });

  it('a filled slot is NOT draggable when onMoveSlotHere is not provided (e.g. combine mode, where dragging doesn\'t apply)', () => {
    render(
      <BinderSlot slotIndex={0} slot={SLOT} cardDef={CARD_DEF} onClickSlot={() => {}} />
    );

    expect(screen.getByLabelText('Pikachu')).toHaveAttribute('draggable', 'false');
  });

  it('dragging a filled slot sets a move-slot payload carrying the source slot id', () => {
    render(
      <BinderSlot slotIndex={0} slot={SLOT} cardDef={CARD_DEF} onClickSlot={() => {}} onMoveSlotHere={() => {}} />
    );

    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(screen.getByLabelText('Pikachu'), { dataTransfer });

    expect(JSON.parse(dataTransfer.getData('application/json'))).toEqual({ type: 'move-slot', slotId: 'slot-1' });
  });

  it('dropping a move-slot payload onto an EMPTY slot calls onMoveSlotHere with the source slot id', () => {
    const onMoveSlotHere = vi.fn();
    render(
      <BinderSlot slotIndex={1} slot={null} cardDef={null} onClickEmpty={() => {}} onMoveSlotHere={onMoveSlotHere} />
    );

    const dataTransfer = makeDataTransfer({ type: 'move-slot', slotId: 'slot-1' });
    fireEvent.drop(screen.getByLabelText('Add card to slot 2'), { dataTransfer });

    expect(onMoveSlotHere).toHaveBeenCalledWith('slot-1');
  });

  it('dropping a move-slot payload onto a DIFFERENT FILLED slot also calls onMoveSlotHere — this is how a swap gets triggered', () => {
    const onMoveSlotHere = vi.fn();
    const targetSlot = { ...SLOT, id: 'slot-2', slotIndex: 1 };
    render(
      <BinderSlot slotIndex={1} slot={targetSlot} cardDef={CARD_DEF} onClickSlot={() => {}} onMoveSlotHere={onMoveSlotHere} />
    );

    const dataTransfer = makeDataTransfer({ type: 'move-slot', slotId: 'slot-1' });
    fireEvent.drop(screen.getByLabelText('Pikachu'), { dataTransfer });

    expect(onMoveSlotHere).toHaveBeenCalledWith('slot-1');
  });

  it('dropping a move-slot payload onto the SAME slot it came from is a no-op, not an error', () => {
    const onMoveSlotHere = vi.fn();
    render(
      <BinderSlot slotIndex={0} slot={SLOT} cardDef={CARD_DEF} onClickSlot={() => {}} onMoveSlotHere={onMoveSlotHere} />
    );

    const dataTransfer = makeDataTransfer({ type: 'move-slot', slotId: 'slot-1' });
    fireEvent.drop(screen.getByLabelText('Pikachu'), { dataTransfer });

    expect(onMoveSlotHere).not.toHaveBeenCalled();
  });

  it('a regular Add Cards panel payload (no type field) still routes to onDropCard, not onMoveSlotHere — the two drag sources stay correctly distinguished', () => {
    const onDropCard = vi.fn();
    const onMoveSlotHere = vi.fn();
    render(
      <BinderSlot slotIndex={1} slot={null} cardDef={null} onClickEmpty={() => {}} onDropCard={onDropCard} onMoveSlotHere={onMoveSlotHere} />
    );

    const dataTransfer = makeDataTransfer({ cardDefId: 'card-2' });
    fireEvent.drop(screen.getByLabelText('Add card to slot 2'), { dataTransfer });

    expect(onDropCard).toHaveBeenCalledWith({ cardDefId: 'card-2' });
    expect(onMoveSlotHere).not.toHaveBeenCalled();
  });

  it('an empty slot with neither onDropCard nor onMoveSlotHere provided ignores drop events entirely, without crashing', () => {
    render(
      <BinderSlot slotIndex={1} slot={null} cardDef={null} onClickEmpty={() => {}} />
    );

    const dataTransfer = makeDataTransfer({ type: 'move-slot', slotId: 'slot-1' });
    expect(() => fireEvent.drop(screen.getByLabelText('Add card to slot 2'), { dataTransfer })).not.toThrow();
  });
});
