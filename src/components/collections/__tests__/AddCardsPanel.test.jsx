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

import { describe, it, expect, vi } from 'vitest';
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
