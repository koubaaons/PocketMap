// @vitest-environment jsdom
/**
 * @fileoverview Tests for HomeView.jsx.
 *
 * Focused specifically on the real bug just fixed: clicking the
 * "Customize cover" shortcut on a binder card opened the binder to
 * the WRONG state — open, at page 1 — instead of closed, directly
 * contradicting this exact code path's own stated comment ("should
 * land on the binder closed with Customize already active"). Not
 * attempting broader coverage of the rest of this file's dashboard
 * layout here, which is unrelated to what changed.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeView } from '../HomeView.jsx';

const mockDispatch = vi.fn();
vi.mock('../../../hooks/useStore.js', () => ({
  useStore: (selector) => selector({
    binders: [{ id: 'binder-1', name: 'Test Binder', rows: 3, cols: 3, pages: 10, cover_color: '#fff' }],
    binderSlots: [],
    binderPanels: [],
    inventory: [],
    cardDefinitions: [],
    collections: [],
  }),
  useDispatch: () => mockDispatch,
}));

describe('HomeView — "Customize cover" shortcut (real bug fix)', () => {
  it('navigates with page 0 (closed), not null, so the binder actually lands closed rather than defaulting open to page 1', () => {
    const onNavigate = vi.fn();
    render(<HomeView toast={vi.fn()} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Customize cover'));

    expect(onNavigate).toHaveBeenCalledWith('binder', 'binder-1', 0, true);
    // The specific old, buggy call this replaces — confirms this
    // isn't just "any truthy 3rd argument", it's specifically 0
    expect(onNavigate).not.toHaveBeenCalledWith('binder', 'binder-1', null, true);
  });

  it('clicking the customize shortcut does not also trigger the card\'s own "open binder" click (they sit in the same clickable area)', () => {
    const onNavigate = vi.fn();
    render(<HomeView toast={vi.fn()} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByLabelText('Customize cover'));

    // Only the one, specific customize-shortcut call should have
    // happened — not a second, separate "open this binder normally" call
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
