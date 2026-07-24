// @vitest-environment jsdom
/**
 * @fileoverview Tests for MultiSelectActionBar.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiSelectActionBar } from '../MultiSelectActionBar.jsx';

function renderBar(props) {
  return render(<MultiSelectActionBar
    count={0} totalAvailable={5} onSelectAll={vi.fn()} onClear={vi.fn()} onExit={vi.fn()}
    actions={[{ label: 'Favorite', onClick: vi.fn() }]}
    {...props}
  />);
}

describe('MultiSelectActionBar', () => {
  it('shows the current selection count', () => {
    renderBar({ count: 3 });
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('shows the total available count on the "Select all" button', () => {
    renderBar({ totalAvailable: 12 });
    expect(screen.getByText('Select all 12')).toBeInTheDocument();
  });

  it('disables "Select all" when there is nothing available to select', () => {
    renderBar({ totalAvailable: 0 });
    expect(screen.getByText('Select all 0')).toBeDisabled();
  });

  it('hides the Clear button when nothing is selected', () => {
    renderBar({ count: 0 });
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('shows the Clear button once something is selected, and calls onClear when clicked', () => {
    const onClear = vi.fn();
    renderBar({ count: 2, onClear });
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('disables every bulk action button when nothing is selected', () => {
    renderBar({ count: 0, actions: [{ label: 'Favorite', onClick: vi.fn() }, { label: 'Unown', onClick: vi.fn() }] });
    expect(screen.getByText('Favorite')).toBeDisabled();
    expect(screen.getByText('Unown')).toBeDisabled();
  });

  it('enables bulk action buttons once something is selected, and calls the action\'s own onClick', () => {
    const onFavorite = vi.fn();
    renderBar({ count: 2, actions: [{ label: 'Favorite', onClick: onFavorite }] });

    const btn = screen.getByText('Favorite');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onFavorite).toHaveBeenCalled();
  });

  it('calls onSelectAll when "Select all" is clicked', () => {
    const onSelectAll = vi.fn();
    renderBar({ totalAvailable: 5, onSelectAll });
    fireEvent.click(screen.getByText('Select all 5'));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('calls onExit when Done is clicked', () => {
    const onExit = vi.fn();
    renderBar({ onExit });
    fireEvent.click(screen.getByText('Done'));
    expect(onExit).toHaveBeenCalled();
  });
});
