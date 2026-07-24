// @vitest-environment jsdom
/**
 * @fileoverview Tests for CollectionList.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollectionList } from '../CollectionList.jsx';

function makeCollection(id, name) {
  return { id, name, is_custom: false };
}

describe('CollectionList', () => {
  it('renders one row per collection', () => {
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set'), makeCollection('col-2', 'Jungle')]}
      statsMap={{}} openMenuId={null}
      onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    expect(screen.getByText('Base Set')).toBeInTheDocument();
    expect(screen.getByText('Jungle')).toBeInTheDocument();
  });

  it('falls back to zeroed stats for a collection missing from statsMap', () => {
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set')]}
      statsMap={{}} openMenuId={null}
      onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    // With no stats provided, total/owned/missing should all render as 0
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('uses the real stats when present in statsMap', () => {
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set')]}
      statsMap={{ 'col-1': { total: 102, owned: 50, missing: 52, pct: 49 } }}
      openMenuId={null}
      onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    expect(screen.getByText('102')).toBeInTheDocument();
  });

  it('only the collection whose id matches openMenuId has its dropdown open', () => {
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set'), makeCollection('col-2', 'Jungle')]}
      statsMap={{}} openMenuId="col-2"
      onToggleMenu={vi.fn()} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    // Only one dropdown menu should be open (one "View Cards" item)
    expect(screen.getAllByText('View Cards')).toHaveLength(1);
  });

  it('clicking a row calls onView with that collection\'s id specifically', () => {
    const onView = vi.fn();
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set'), makeCollection('col-2', 'Jungle')]}
      statsMap={{}} openMenuId={null}
      onToggleMenu={vi.fn()} onView={onView} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getByText('Jungle'));

    expect(onView).toHaveBeenCalledWith('col-2');
  });

  it('toggling the menu on one row calls onToggleMenu with that row\'s id', () => {
    const onToggleMenu = vi.fn();
    render(<CollectionList
      collections={[makeCollection('col-1', 'Base Set'), makeCollection('col-2', 'Jungle')]}
      statsMap={{}} openMenuId={null}
      onToggleMenu={onToggleMenu} onView={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
    />);

    fireEvent.click(screen.getAllByLabelText('Collection actions')[1]);

    expect(onToggleMenu).toHaveBeenCalledWith('col-2');
  });
});
