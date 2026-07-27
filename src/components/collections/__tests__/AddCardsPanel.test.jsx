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

import { describe, it, expect } from 'vitest';
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