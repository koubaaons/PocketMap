// @vitest-environment jsdom
/**
 * @fileoverview Tests for InsertLibraryPanel.jsx.
 *
 * First tests for this file — focused specifically on the two things
 * just added: the whole-panel-background dragging fix (matching the
 * identical fix already applied to AddCardsPanel.jsx) and the new
 * drag/resize discoverability hint. Not attempting broader coverage
 * of the rest of this file's library-browsing/upload logic here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsertLibraryPanel } from '../InsertLibraryPanel.jsx';

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../hooks/useBinderInsertActions.js', () => ({
  useBinderInsertActions: () => ({ handleBulkAddInserts: vi.fn() }),
}));

function renderPanel(props) {
  return render(
    <InsertLibraryPanel binderInserts={[]} toast={vi.fn()} onClose={vi.fn()} {...props} />
  );
}

describe('InsertLibraryPanel — drag from anywhere on the background (matches AddCardsPanel.jsx\'s identical fix)', () => {
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

  it('mousedown on the Done button does NOT start dragging', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByText('Done'));

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });

  it('real gap fixed: mousedown on a draggable library item tile does NOT also start a panel drag — these tiles have draggable but no role="button", so this specifically needed the [draggable="true"] exclusion, not just the role="button" one', () => {
    const insert = { id: 'insert-1', name: 'My Sticker', image_url: 'https://x/sticker.png' };
    renderPanel({ binderInserts: [insert] });

    const tile = screen.getByTitle('My Sticker');
    expect(tile).toHaveAttribute('draggable', 'true');
    expect(tile).not.toHaveAttribute('role', 'button');

    fireEvent.mouseDown(tile);

    expect(screen.getByRole('complementary')).not.toHaveClass('add-cards-panel-dragging');
  });

  it('mousedown on the dedicated drag handle still works too', () => {
    renderPanel();

    fireEvent.mouseDown(screen.getByTitle('Drag to move this panel'));

    expect(screen.getByRole('complementary')).toHaveClass('add-cards-panel-dragging');
  });
});

describe('InsertLibraryPanel — drag/resize discoverability hint (real feature)', () => {
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
