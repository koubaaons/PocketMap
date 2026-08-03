// @vitest-environment jsdom
/**
 * @fileoverview Tests for AddCardsPanel.jsx.
 *
 * Focused specifically on the new Owned/Missing tabs and Favorites
 * filter, requested directly to mirror Collection's own tab
 * structure. Deliberately not testing the panel's own drag/resize
 * mechanics here — that's positioning/layout logic, not the kind of
 * thing jsdom meaningfully validates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddCardsPanel } from '../AddCardsPanel.jsx';

const COLLECTION = { id: 'col-1', name: 'Base Set' };

function makeCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', collectionId: 'col-1', isDecluttered: false, image_url: null, ...overrides };
}

function renderPanel(props) {
  return render(
    <AddCardsPanel
      cardDefinitions={[]}
      collections={[COLLECTION]}
      inventory={[]}
      allBinderSlots={[]}
      allBinderPanels={[]}
      onClose={() => {}}
      {...props}
    />
  );
}

describe('AddCardsPanel — click-to-place (real feature: requested directly, click a card in addition to dragging one)', () => {
  it('clicking a card calls onClickCard with that card', () => {
    const onClickCard = vi.fn();
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card], onClickCard });

    fireEvent.click(screen.getByText('Pikachu'));

    expect(onClickCard).toHaveBeenCalledWith(card);
  });

  it('pressing Enter on a focused card also calls onClickCard — basic keyboard accessibility for what was otherwise a mouse/touch-only interaction', () => {
    const onClickCard = vi.fn();
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card], onClickCard });

    fireEvent.keyDown(screen.getByText('Pikachu').closest('[role="button"]'), { key: 'Enter' });

    expect(onClickCard).toHaveBeenCalledWith(card);
  });

  it('pressing Space on a focused card also calls onClickCard', () => {
    const onClickCard = vi.fn();
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card], onClickCard });

    fireEvent.keyDown(screen.getByText('Pikachu').closest('[role="button"]'), { key: ' ' });

    expect(onClickCard).toHaveBeenCalledWith(card);
  });

  it('clicking a card does not throw if onClickCard was never provided', () => {
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card] });

    expect(() => fireEvent.click(screen.getByText('Pikachu'))).not.toThrow();
  });

  it('an unowned card can also be clicked to place — matches the existing drag behavior, which already allows placing unowned cards as a grey placeholder', () => {
    const onClickCard = vi.fn();
    const card = makeCard({ id: 'card-1', name: 'Missing Card' });
    renderPanel({ cardDefinitions: [card], inventory: [], onClickCard });

    fireEvent.click(screen.getByText('Missing Card'));

    expect(onClickCard).toHaveBeenCalledWith(card);
  });

  it('highlights the currently selected card with a distinct class', () => {
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card], selectedCardId: 'card-1' });

    expect(screen.getByText('Pikachu').closest('[role="button"]')).toHaveClass('add-cards-panel-tile-selected');
  });

  it('does not highlight a card that is not the selected one', () => {
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card], selectedCardId: 'card-2' });

    expect(screen.getByText('Pikachu').closest('[role="button"]')).not.toHaveClass('add-cards-panel-tile-selected');
  });

  it('shows guidance to click a slot once a card is selected', () => {
    renderPanel({ selectedCardId: 'card-1' });
    expect(screen.getByText(/Click an empty slot to place the selected card/)).toBeInTheDocument();
  });

  it('shows the default drag-or-click guidance when nothing is selected', () => {
    renderPanel({ selectedCardId: undefined });
    expect(screen.getByText(/Drag a card onto any empty slot, or click a card then a slot/)).toBeInTheDocument();
  });
});

describe('AddCardsPanel — drag from anywhere on the background (real feature: requested directly, the whole panel should be draggable, not just the top handle)', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true, writable: true });
  });

  it('mousedown on the panel\'s own background starts dragging', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByRole('complementary'));

    expect(screen.getByRole('complementary')).toHaveClass('add-cards-panel-dragging');
  });

  it('mousedown on a button inside the panel does NOT start dragging — it should keep working normally instead', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByText('Done'));

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });

  it('mousedown on the search input does NOT start dragging', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByPlaceholderText(/search/i));

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });

  it('mousedown on a card tile (role="button") does NOT start a panel drag — that\'s the card\'s own drag-to-place gesture instead', () => {
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card] });

    fireEvent.mouseDown(screen.getByText('Pikachu'));

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });

  it('mousedown on the dedicated drag handle still works too, same as before', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByTitle('Drag to move this panel'));

    expect(screen.getByRole('complementary')).toHaveClass('add-cards-panel-dragging');
  });

  it('real bug fixed while applying this to InsertLibraryPanel.jsx: any element that is itself draggable is also excluded from starting a panel drag, not just role="button" elements — otherwise dragging a card tile (draggable, but this component\'s tiles specifically also have role="button") would risk starting both the card\'s own drag AND a panel-move drag simultaneously', () => {
    const card = makeCard({ id: 'card-1', name: 'Pikachu' });
    renderPanel({ cardDefinitions: [card] });

    expect(screen.getByText('Pikachu').closest('[role="button"]')).toHaveAttribute('draggable', 'true');
    fireEvent.mouseDown(screen.getByText('Pikachu'));

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });
});

describe('AddCardsPanel — drag/resize discoverability hint (real feature)', () => {
  it('shows the hint when showDragHint is true', () => {
    renderPanel({ showDragHint: true });
    expect(screen.getByText(/This panel can be dragged from anywhere/)).toBeInTheDocument();
  });

  it('does not show the hint when showDragHint is false', () => {
    renderPanel({ showDragHint: false });
    expect(screen.queryByText(/This panel can be dragged from anywhere/)).not.toBeInTheDocument();
  });

  it('dismissing the hint calls onDismissDragHint', () => {
    const onDismiss = vi.fn();
    renderPanel({ showDragHint: true, onDismissDragHint: onDismiss });

    fireEvent.click(screen.getByLabelText('Dismiss tip'));

    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('AddCardsPanel — ownership tabs', () => {
  it('defaults to the "Cards" tab, showing both owned and unowned cards', () => {
    renderPanel({
      cardDefinitions: [makeCard({ id: 'owned-card', name: 'Owned Card' }), makeCard({ id: 'missing-card', name: 'Missing Card' })],
      inventory: [{ id: 'inv-1', cardDefId: 'owned-card' }],
    });

    expect(screen.getByText('Owned Card')).toBeInTheDocument();
    expect(screen.getByText('Missing Card')).toBeInTheDocument();
  });

  it('the Owned tab shows only owned cards', () => {
    renderPanel({
      cardDefinitions: [makeCard({ id: 'owned-card', name: 'Owned Card' }), makeCard({ id: 'missing-card', name: 'Missing Card' })],
      inventory: [{ id: 'inv-1', cardDefId: 'owned-card' }],
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Owned' }));

    expect(screen.getByText('Owned Card')).toBeInTheDocument();
    expect(screen.queryByText('Missing Card')).not.toBeInTheDocument();
  });

  it('the Missing tab shows only unowned cards', () => {
    renderPanel({
      cardDefinitions: [makeCard({ id: 'owned-card', name: 'Owned Card' }), makeCard({ id: 'missing-card', name: 'Missing Card' })],
      inventory: [{ id: 'inv-1', cardDefId: 'owned-card' }],
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Missing' }));

    expect(screen.queryByText('Owned Card')).not.toBeInTheDocument();
    expect(screen.getByText('Missing Card')).toBeInTheDocument();
  });
});

describe('AddCardsPanel — empty-account state (real feature: a first-time user with zero owned cards anywhere)', () => {
  it('shows a message explaining the ownership model, and a "Go to Collections" button, when the account owns nothing at all', () => {
    renderPanel({ cardDefinitions: [], inventory: [], onNavigate: () => {} });

    expect(screen.getByText(/You don't own any cards yet/)).toBeInTheDocument();
    expect(screen.getByText('Go to Collections')).toBeInTheDocument();
    // The old, generic message shouldn't also be showing at the same time
    expect(screen.queryByText('Every card you own is already placed')).not.toBeInTheDocument();
  });

  it('calling the "Go to Collections" button navigates to collections', () => {
    const onNavigate = vi.fn();
    renderPanel({ cardDefinitions: [], inventory: [], onNavigate });

    fireEvent.click(screen.getByText('Go to Collections'));

    expect(onNavigate).toHaveBeenCalledWith('collections');
  });

  it('does NOT show the empty-account message for someone who owns cards but has placed all of them — the original, correct message for that case stays as-is', () => {
    renderPanel({
      cardDefinitions: [makeCard({ id: 'owned-card', name: 'Owned Card' })],
      inventory: [{ id: 'inv-1', cardDefId: 'owned-card' }],
      allBinderSlots: [{ id: 'slot-1', cardDefId: 'owned-card', inventoryItemId: 'inv-1' }],
      onNavigate: () => {},
    });

    expect(screen.getByText('Every card you own is already placed')).toBeInTheDocument();
    expect(screen.queryByText(/You don't own any cards yet/)).not.toBeInTheDocument();
  });

  it('does NOT show the empty-account message while actively searching, even with zero owned cards — a real search miss should show the search-specific message instead', () => {
    renderPanel({ cardDefinitions: [], inventory: [], onNavigate: () => {} });

    fireEvent.change(screen.getByLabelText('Search cards'), { target: { value: 'pikachu' } });

    expect(screen.getByText('No cards found for "pikachu"')).toBeInTheDocument();
    expect(screen.queryByText(/You don't own any cards yet/)).not.toBeInTheDocument();
  });

  it('does not render a "Go to Collections" button at all if onNavigate was never provided, rather than crashing', () => {
    renderPanel({ cardDefinitions: [], inventory: [] });

    expect(screen.getByText(/You don't own any cards yet/)).toBeInTheDocument();
    expect(screen.queryByText('Go to Collections')).not.toBeInTheDocument();
  });
});

describe('AddCardsPanel — Favorites filter', () => {
  it('shows only favorited cards when Favorites is toggled on', () => {
    renderPanel({
      cardDefinitions: [makeCard({ id: 'fav-card', name: 'Favorite Card' }), makeCard({ id: 'plain-card', name: 'Plain Card' })],
      inventory: [
        { id: 'inv-1', cardDefId: 'fav-card', is_favorite: true },
        { id: 'inv-2', cardDefId: 'plain-card', is_favorite: false },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /Favorites/ }));

    expect(screen.getByText('Favorite Card')).toBeInTheDocument();
    expect(screen.queryByText('Plain Card')).not.toBeInTheDocument();
  });

  it('is disabled while the Missing tab is active — an unowned card can\'t be a favorite at all', () => {
    renderPanel({ cardDefinitions: [makeCard()] });

    fireEvent.click(screen.getByRole('tab', { name: 'Missing' }));

    expect(screen.getByRole('button', { name: /Favorites/ })).toBeDisabled();
  });

  it('combining Owned + Favorites shows only owned, favorited cards', () => {
    renderPanel({
      cardDefinitions: [
        makeCard({ id: 'owned-fav', name: 'Owned Favorite' }),
        makeCard({ id: 'owned-plain', name: 'Owned Plain' }),
        makeCard({ id: 'missing-card', name: 'Missing Card' }),
      ],
      inventory: [
        { id: 'inv-1', cardDefId: 'owned-fav', is_favorite: true },
        { id: 'inv-2', cardDefId: 'owned-plain', is_favorite: false },
      ],
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Owned' }));
    fireEvent.click(screen.getByRole('button', { name: /Favorites/ }));

    expect(screen.getByText('Owned Favorite')).toBeInTheDocument();
    expect(screen.queryByText('Owned Plain')).not.toBeInTheDocument();
    expect(screen.queryByText('Missing Card')).not.toBeInTheDocument();
  });
});
