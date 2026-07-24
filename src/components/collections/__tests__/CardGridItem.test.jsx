// @vitest-environment jsdom
/**
 * @fileoverview Tests for CardGridItem.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CardGridItem } from '../CardGridItem.jsx';

function makeCard(overrides = {}) {
  return { id: 'card-1', name: 'Pikachu', image_url: null, ...overrides };
}

describe('CardGridItem — select mode', () => {
  it('clicking the tile in select mode toggles selection instead of calling onView', () => {
    const onView = vi.fn();
    const onToggleSelect = vi.fn();
    render(<CardGridItem card={makeCard()} inventoryItem={null} onView={onView} isSelectMode onToggleSelect={onToggleSelect} />);

    fireEvent.click(screen.getByLabelText('Pikachu'));

    expect(onToggleSelect).toHaveBeenCalledWith('card-1');
    expect(onView).not.toHaveBeenCalled();
  });

  it('a normal (non-select-mode) click calls onView instead', () => {
    const onView = vi.fn();
    const onToggleSelect = vi.fn();
    render(<CardGridItem card={makeCard()} inventoryItem={null} onView={onView} onToggleSelect={onToggleSelect} />);

    fireEvent.click(screen.getByLabelText('Pikachu'));

    expect(onView).toHaveBeenCalled();
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('keyboard activation (Enter) triggers the same action as a click', () => {
    const onView = vi.fn();
    render(<CardGridItem card={makeCard()} inventoryItem={null} onView={onView} />);

    fireEvent.keyDown(screen.getByLabelText('Pikachu'), { key: 'Enter' });

    expect(onView).toHaveBeenCalled();
  });
});

describe('CardGridItem — badges', () => {
  it('shows the quantity-placed badge only when more than one copy is owned', () => {
    const { rerender } = render(
      <CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1' }} quantityOwned={1} totalPlaced={1} onView={vi.fn()} />
    );
    expect(screen.queryByText(/of 1 placed/)).not.toBeInTheDocument();

    rerender(<CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1' }} quantityOwned={3} totalPlaced={2} onView={vi.fn()} />);
    expect(screen.getByText('2 of 3 placed')).toBeInTheDocument();
  });

  it('shows the condition/language info badge for an owned card that has either set', () => {
    render(<CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1', condition_rating: 'near_mint', language: 'english' }} onView={vi.fn()} />);
    expect(screen.getByText(/Near Mint/i)).toBeInTheDocument();
  });

  it('does not show the info badge for an unowned card even if somehow given condition/language data', () => {
    render(<CardGridItem card={makeCard()} inventoryItem={null} onView={vi.fn()} />);
    expect(screen.queryByText(/Near Mint/i)).not.toBeInTheDocument();
  });
});

describe('CardGridItem — non-clickable status (no onToggleOwned)', () => {
  it('renders a plain (non-button) status indicator when onToggleOwned is not provided — e.g. FavoritesView', () => {
    render(<CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1' }} onView={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /collection|owned/i })).not.toBeInTheDocument();
    expect(screen.getByTitle('Owned')).toBeInTheDocument();
  });
});

describe('CardGridItem — ownership reveal animation', () => {
  it('plays the reveal shine briefly when a card transitions from unowned to owned', () => {
    vi.useFakeTimers();
    const { rerender } = render(<CardGridItem card={makeCard()} inventoryItem={null} onView={vi.fn()} />);

    rerender(<CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1' }} onView={vi.fn()} />);

    expect(document.querySelector('.card-grid-item-reveal-shine')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(500); });
    expect(document.querySelector('.card-grid-item-reveal-shine')).toBeFalsy();

    vi.useRealTimers();
  });

  it('does NOT play the reveal animation on first mount for an already-owned card', () => {
    render(<CardGridItem card={makeCard()} inventoryItem={{ id: 'inv-1' }} onView={vi.fn()} />);
    expect(document.querySelector('.card-grid-item-reveal-shine')).toBeFalsy();
  });
});
