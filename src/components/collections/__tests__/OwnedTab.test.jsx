// @vitest-environment jsdom
/**
 * @fileoverview Tests for OwnedTab.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OwnedTab } from '../OwnedTab.jsx';
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
    collectionCards: [], collectionTemplateFields: [], ownershipMap: {}, inventory: [],
    binderSlots: [], binderPanels: [], showCardInfo: true, onToggleCardInfo: vi.fn(),
    summary: { owned: 0 }, onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
    onToggleOwned: vi.fn(), onToggleFavorite: vi.fn(), toast: vi.fn(),
    ...props,
  };
  return render(
    <CollectionDataProvider value={{ inventory: defaultProps.inventory, allBinderSlots: [], allBinderPanels: [] }}>
      <OwnedTab {...defaultProps} />
    </CollectionDataProvider>
  );
}

describe('OwnedTab', () => {
  it('shows every owned card, whether organised or not — unlike UnorganisedTab, placement is irrelevant here', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    renderTab({
      collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv],
      binderSlots: [{ id: 'slot-1', binderId: 'binder-1', cardDefId: 'card-1', pageNumber: 1, slotIndex: 0 }],
      summary: { owned: 1 },
    });

    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });

  it('does not show an unowned card', () => {
    renderTab({ collectionCards: [makeCard()], ownershipMap: {}, summary: { owned: 0 } });
    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });

  it('clicking the favorite star calls onToggleFavorite with the inventory item', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    const onToggleFavorite = vi.fn();
    renderTab({ collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv], summary: { owned: 1 }, onToggleFavorite });

    fireEvent.click(screen.getByLabelText('Add Pikachu to favorites'));

    expect(onToggleFavorite).toHaveBeenCalledWith(inv);
  });

  it('clicking the ownership toggle calls onToggleOwned with the card and inventory item', () => {
    const card = makeCard();
    const inv = makeInventoryItem();
    const onToggleOwned = vi.fn();
    renderTab({ collectionCards: [card], ownershipMap: { 'card-1': inv }, inventory: [inv], summary: { owned: 1 }, onToggleOwned });

    fireEvent.click(screen.getByLabelText('Remove Pikachu from your collection'));

    expect(onToggleOwned).toHaveBeenCalledWith(card, inv);
  });

  it('shows the empty state for zero owned cards', () => {
    renderTab({ collectionCards: [], ownershipMap: {}, summary: { owned: 0 } });
    expect(screen.getByText('No owned cards yet')).toBeInTheDocument();
  });
});
