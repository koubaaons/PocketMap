// @vitest-environment jsdom
/**
 * @fileoverview Tests for UnorganisedTab.jsx.
 *
 * This component (and its siblings OwnedTab/MissingTab) was the exact
 * site of a real historical bug: onToggleOwned/onToggleFavorite simply
 * weren't being accepted or forwarded at all, so the favorite star and
 * ownership toggle silently did nothing. The most valuable tests here
 * directly exercise that: render a real card, click the real button,
 * assert the callback actually fired.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnorganisedTab } from '../UnorganisedTab.jsx';
import { CollectionDataProvider } from '../../../contexts/CollectionDataContext.jsx';

const mockDispatch = vi.fn();
vi.mock('../../../hooks/useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

function makeCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', collectionId: 'col-1', isDecluttered: false, ...overrides };
}

function makeInventoryItem(overrides = {}) {
  return { id: 'inv-1', cardDefId: 'card-1', is_favorite: false, ...overrides };
}

function renderTab(props) {
  const defaultProps = {
    collectionCards: [],
    collectionTemplateFields: [],
    ownershipMap: {},
    inventory: [],
    binderSlots: [],
    binderPanels: [],
    showCardInfo: true,
    onToggleCardInfo: vi.fn(),
    summary: { unorganised: 0 },
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleOwned: vi.fn(),
    onToggleFavorite: vi.fn(),
    toast: vi.fn(),
    ...props,
  };
  return render(
    <CollectionDataProvider value={{ inventory: defaultProps.inventory, allBinderSlots: [], allBinderPanels: [] }}>
      <UnorganisedTab {...defaultProps} />
    </CollectionDataProvider>
  );
}

describe('UnorganisedTab', () => {
  it('shows a card that is owned but not placed in any binder', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    renderTab({
      collectionCards: [card],
      ownershipMap: { 'card-1': inv },
      inventory: [inv],
      summary: { unorganised: 1 },
    });

    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });

  it('does NOT show a card that is owned but already organised (placed in a binder slot)', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    renderTab({
      collectionCards: [card],
      ownershipMap: { 'card-1': inv },
      inventory: [inv],
      binderSlots: [{ id: 'slot-1', binderId: 'binder-1', cardDefId: 'card-1', pageNumber: 1, slotIndex: 0 }],
      summary: { unorganised: 0 },
    });

    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });

  it('does NOT show a card that is not owned at all', () => {
    const card = makeCard();
    renderTab({ collectionCards: [card], ownershipMap: {}, summary: { unorganised: 0 } });

    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });

  it('clicking the favorite star calls onToggleFavorite with the inventory item — regression test for the historical "silently does nothing" bug', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    const onToggleFavorite = vi.fn();
    renderTab({
      collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv],
      summary: { unorganised: 1 }, onToggleFavorite,
    });

    fireEvent.click(screen.getByLabelText('Add Pikachu to favorites'));

    expect(onToggleFavorite).toHaveBeenCalledWith(inv);
  });

  it('clicking the owned/unowned toggle calls onToggleOwned with the card and inventory item — same regression coverage for ownership', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    const onToggleOwned = vi.fn();
    renderTab({
      collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv],
      summary: { unorganised: 1 }, onToggleOwned,
    });

    fireEvent.click(screen.getByLabelText('Remove Pikachu from your collection'));

    expect(onToggleOwned).toHaveBeenCalledWith(card, inv);
  });

  it('clicking a card (outside the star/toggle) calls onView with that card', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    const onView = vi.fn();
    renderTab({
      collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv],
      summary: { unorganised: 1 }, onView,
    });

    fireEvent.click(screen.getByLabelText('Pikachu'));

    expect(onView).toHaveBeenCalledWith(card);
  });

  it('shows an empty state with an appropriate message when there are no unorganised cards', () => {
    renderTab({ collectionCards: [], ownershipMap: {}, summary: { unorganised: 0 } });
    expect(screen.getByText('No unorganised cards')).toBeInTheDocument();
  });

  it('searching filters the visible cards by name', () => {
    const cardA = makeCard({ id: 'card-1', name: 'Pikachu' });
    const cardB = makeCard({ id: 'card-2', name: 'Charizard' });
    const invA = makeInventoryItem({ id: 'inv-1', cardDefId: 'card-1' });
    const invB = makeInventoryItem({ id: 'inv-2', cardDefId: 'card-2' });
    renderTab({
      collectionCards: [cardA, cardB],
      ownershipMap: { 'card-1': invA, 'card-2': invB },
      inventory: [invA, invB],
      summary: { unorganised: 2 },
    });

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Char' } });

    expect(screen.getByText('Charizard')).toBeInTheDocument();
    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });
});
