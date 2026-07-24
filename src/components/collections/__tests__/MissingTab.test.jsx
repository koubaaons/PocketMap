// @vitest-environment jsdom
/**
 * @fileoverview Tests for MissingTab.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissingTab } from '../MissingTab.jsx';
import { CollectionDataProvider } from '../../../contexts/CollectionDataContext.jsx';

const mockDispatch = vi.fn();
vi.mock('../../../hooks/useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

function makeCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', collectionId: 'col-1', isDecluttered: false, ...overrides };
}

function renderTab(props) {
  const defaultProps = {
    collectionCards: [], collectionTemplateFields: [], collectionId: 'col-1', ownershipMap: {},
    binderSlots: [], binderPanels: [], showCardInfo: true, onToggleCardInfo: vi.fn(),
    summary: { missing: 0 }, onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
    onToggleOwned: vi.fn(), toast: vi.fn(),
    ...props,
  };
  return render(
    <CollectionDataProvider value={{ inventory: [], allBinderSlots: [], allBinderPanels: [] }}>
      <MissingTab {...defaultProps} />
    </CollectionDataProvider>
  );
}

describe('MissingTab', () => {
  it('shows a card that is not owned', () => {
    renderTab({ collectionCards: [makeCard()], ownershipMap: {}, summary: { missing: 1 } });
    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });

  it('does not show a card that IS owned', () => {
    const card = makeCard();
    renderTab({
      collectionCards: [card],
      ownershipMap: { 'card-1': { id: 'inv-1', cardDefId: 'card-1' } },
      summary: { missing: 0 },
    });
    expect(screen.queryByText('Pikachu')).not.toBeInTheDocument();
  });

  it('clicking the ownership toggle on a missing card calls onToggleOwned with the card and no inventory item', () => {
    const card = makeCard();
    const onToggleOwned = vi.fn();
    renderTab({ collectionCards: [card], ownershipMap: {}, summary: { missing: 1 }, onToggleOwned });

    fireEvent.click(screen.getByLabelText('Mark Pikachu as owned'));

    expect(onToggleOwned).toHaveBeenCalledWith(card, null);
  });

  it('does not render a favorite star at all for a missing card — favoriting only makes sense for owned copies', () => {
    renderTab({ collectionCards: [makeCard()], ownershipMap: {}, summary: { missing: 1 } });
    expect(screen.queryByLabelText(/favorites/)).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing is missing', () => {
    renderTab({ collectionCards: [], ownershipMap: {}, summary: { missing: 0 } });
    expect(screen.getByText('No missing cards')).toBeInTheDocument();
  });
});
