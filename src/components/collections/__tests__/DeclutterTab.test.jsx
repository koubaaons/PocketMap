// @vitest-environment jsdom
/**
 * @fileoverview Tests for DeclutterTab.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeclutterTab } from '../DeclutterTab.jsx';
import { CollectionDataProvider } from '../../../contexts/CollectionDataContext.jsx';

const mockDispatch = vi.fn();
vi.mock('../../../hooks/useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

function makeCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', collectionId: 'col-1', isDecluttered: true, ...overrides };
}

function renderTab(props) {
  const defaultProps = {
    declutteredCards: [], collectionTemplateFields: [], ownershipMap: {},
    showCardInfo: true, onToggleCardInfo: vi.fn(), onView: vi.fn(), toast: vi.fn(),
    ...props,
  };
  return render(
    <CollectionDataProvider value={{ inventory: [], allBinderSlots: [], allBinderPanels: [] }}>
      <DeclutterTab {...defaultProps} />
    </CollectionDataProvider>
  );
}

describe('DeclutterTab', () => {
  it('shows the given decluttered cards', () => {
    renderTab({ declutteredCards: [makeCard()] });
    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is decluttered', () => {
    renderTab({ declutteredCards: [] });
    expect(screen.getByText('Nothing decluttered')).toBeInTheDocument();
  });

  it('shows the explanatory intro text about what this tab is', () => {
    renderTab({ declutteredCards: [] });
    expect(screen.getByText(/Cards you've hidden away/)).toBeInTheDocument();
  });

  it('does not render a favorite star or ownership toggle — this tab is restore-only', () => {
    renderTab({ declutteredCards: [makeCard()] });
    expect(screen.queryByLabelText(/favorites/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/as owned|from your collection/)).not.toBeInTheDocument();
  });

  it('entering select mode and choosing Restore dispatches the un-declutter action for the selected cards', async () => {
    const cardA = makeCard({ id: 'card-1', name: 'Pikachu' });
    const cardB = makeCard({ id: 'card-2', name: 'Raichu' });
    renderTab({ declutteredCards: [cardA, cardB] });
    const { ACTIONS } = await import('../../../store/index.js');

    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByLabelText('Pikachu'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: ACTIONS.CARD_DEFINITION_BULK_SET_DECLUTTERED,
      payload: expect.objectContaining({ ids: ['card-1'], isDecluttered: false }),
    }));
  });
});
