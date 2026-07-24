// @vitest-environment jsdom
/**
 * @fileoverview Tests for CollectionRow.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionRow } from '../CollectionRow.jsx';

function makeCollection(overrides = {}) {
  return { id: 'col-1', name: 'Base Set', is_custom: false, cover_image_url: null, import_source: null, ...overrides };
}

function renderRow(props) {
  return render(<CollectionRow
    collection={makeCollection()}
    stats={{ total: 100, owned: 40, missing: 60, pct: 40 }}
    menuOpen={false}
    onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    {...props}
  />);
}

describe('CollectionRow — display', () => {
  it('shows the collection name and stats', () => {
    renderRow();
    expect(screen.getByText('Base Set')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('shows an "API" badge for a non-custom collection and "Custom" for a custom one', () => {
    const { rerender } = renderRow({ collection: makeCollection({ is_custom: false }) });
    expect(screen.getByText('API')).toBeInTheDocument();

    rerender(<CollectionRow collection={makeCollection({ is_custom: true })} stats={{ total: 0, owned: 0, missing: 0, pct: 0 }} menuOpen={false} onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows the import source when present, hides it when absent', () => {
    const { rerender } = renderRow({ collection: makeCollection({ import_source: 'Pokemon TCG API' }) });
    expect(screen.getByText('Pokemon TCG API')).toBeInTheDocument();

    rerender(<CollectionRow collection={makeCollection({ import_source: null })} stats={{ total: 0, owned: 0, missing: 0, pct: 0 }} menuOpen={false} onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Pokemon TCG API')).not.toBeInTheDocument();
  });

  it('shows a placeholder icon when there is no cover image', () => {
    renderRow({ collection: makeCollection({ cover_image_url: null }) });
    expect(screen.getByText('◈')).toBeInTheDocument();
  });
});

describe('CollectionRow — actions menu', () => {
  it('the dropdown menu is hidden unless menuOpen is true', () => {
    const { rerender } = renderRow({ menuOpen: false });
    expect(screen.queryByText('View Cards')).not.toBeInTheDocument();

    rerender(<CollectionRow collection={makeCollection()} stats={{ total: 0, owned: 0, missing: 0, pct: 0 }} menuOpen onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('View Cards')).toBeInTheDocument();
  });

  it('clicking the three-dot trigger calls onToggleMenu', () => {
    const onToggleMenu = vi.fn();
    renderRow({ onToggleMenu });
    fireEvent.click(screen.getByLabelText('Collection actions'));
    expect(onToggleMenu).toHaveBeenCalled();
  });

  it('hides "Update from API" for a custom collection (nothing to update from)', () => {
    renderRow({ collection: makeCollection({ is_custom: true }), menuOpen: true });
    expect(screen.queryByText('Update from API')).not.toBeInTheDocument();
  });

  it('shows "Update from API" for a non-custom (API-sourced) collection', () => {
    renderRow({ collection: makeCollection({ is_custom: false }), menuOpen: true });
    expect(screen.getByText('Update from API')).toBeInTheDocument();
  });

  it('clicking Edit/Delete in the menu calls the respective callbacks', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderRow({ menuOpen: true, onEdit, onDelete });

    fireEvent.click(screen.getByText('Edit Collection'));
    fireEvent.click(screen.getByText('Delete Collection'));

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
