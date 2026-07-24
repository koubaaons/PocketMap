// @vitest-environment jsdom
/**
 * @fileoverview Tests for TabToolbar.jsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabToolbar } from '../TabToolbar.jsx';

// TabToolbar is fully controlled (query/sort/filters are props, not
// internal state) — this thin wrapper manages that state so tests can
// interact with it the way a real parent tab would.
function StatefulToolbar(props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [filters, setFilters] = useState({});
  return <TabToolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} filters={filters} setFilters={setFilters} {...props} />;
}

describe('TabToolbar — search', () => {
  it('typing in the search box updates the query', () => {
    render(<StatefulToolbar />);
    fireEvent.change(screen.getByLabelText('Search cards'), { target: { value: 'Pikachu' } });
    expect(screen.getByLabelText('Search cards')).toHaveValue('Pikachu');
  });

  it('shows a clear button only once there is a query, and clicking it empties the search', () => {
    render(<StatefulToolbar />);
    expect(screen.queryByText('✕')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search cards'), { target: { value: 'Pikachu' } });
    fireEvent.click(screen.getByText('✕'));

    expect(screen.getByLabelText('Search cards')).toHaveValue('');
  });
});

describe('TabToolbar — filters', () => {
  const filterGroups = [{ key: 'rarity', label: 'Rarity', options: [{ value: 'Common', label: 'Common' }, { value: 'Rare', label: 'Rare' }] }];

  it('does not render the Filters control at all when there are no filter groups', () => {
    render(<StatefulToolbar filterGroups={[]} />);
    expect(screen.queryByText(/Filters/)).not.toBeInTheDocument();
  });

  it('the filter popover is hidden until the Filters button is clicked', () => {
    render(<StatefulToolbar filterGroups={filterGroups} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Filters'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows an active-count badge on the Filters button once a filter is selected', () => {
    render(<StatefulToolbar filterGroups={filterGroups} />);
    fireEvent.click(screen.getByText('Filters'));

    fireEvent.change(screen.getByLabelText('Rarity'), { target: { value: 'Rare' } });

    expect(screen.getByText('Filters (1)')).toBeInTheDocument();
  });

  it('"Clear filters" resets all active filters back to Any', () => {
    render(<StatefulToolbar filterGroups={filterGroups} />);
    fireEvent.click(screen.getByText('Filters'));
    fireEvent.change(screen.getByLabelText('Rarity'), { target: { value: 'Rare' } });

    fireEvent.click(screen.getByText('Clear filters'));

    expect(screen.getByLabelText('Rarity')).toHaveValue('');
    expect(screen.getByText('Filters')).toBeInTheDocument(); // no (1) badge anymore
  });

  it('translates a holoType filter\'s option values to their display labels, unlike other filter groups', () => {
    const holoGroup = [{ key: 'holoType', label: 'Holo Effect', options: [{ value: 'rainbow', label: 'rainbow' }] }];
    render(<StatefulToolbar filterGroups={holoGroup} />);
    fireEvent.click(screen.getByText('Filters'));

    // The real display label should differ from the raw internal id
    expect(screen.queryByText('rainbow')).not.toBeInTheDocument();
  });
});

describe('TabToolbar — optional controls', () => {
  it('shows the select-mode toggle only when onToggleSelectMode is provided', () => {
    const { rerender } = render(<StatefulToolbar />);
    expect(screen.queryByText('Select')).not.toBeInTheDocument();

    rerender(<StatefulToolbar onToggleSelectMode={vi.fn()} />);
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('clicking the select-mode toggle calls onToggleSelectMode', () => {
    const onToggleSelectMode = vi.fn();
    render(<StatefulToolbar onToggleSelectMode={onToggleSelectMode} />);
    fireEvent.click(screen.getByText('Select'));
    expect(onToggleSelectMode).toHaveBeenCalled();
  });

  it('shows "Cancel Select" instead of "Select" while already in select mode', () => {
    render(<StatefulToolbar onToggleSelectMode={vi.fn()} isSelectMode />);
    expect(screen.getByText('Cancel Select')).toBeInTheDocument();
  });

  it('shows the card-info toggle only when onToggleCardInfo is provided, and reflects current state', () => {
    const { rerender } = render(<StatefulToolbar />);
    expect(screen.queryByText(/Card Info/)).not.toBeInTheDocument();

    rerender(<StatefulToolbar onToggleCardInfo={vi.fn()} showCardInfo={true} />);
    expect(screen.getByText('Hide Card Info')).toBeInTheDocument();

    rerender(<StatefulToolbar onToggleCardInfo={vi.fn()} showCardInfo={false} />);
    expect(screen.getByText('Show Card Info')).toBeInTheDocument();
  });

  it('shows the Add Card button only when both showAdd and onAdd are given', () => {
    const { rerender } = render(<StatefulToolbar showAdd onAdd={undefined} />);
    expect(screen.queryByText('+ Add Card')).not.toBeInTheDocument();

    rerender(<StatefulToolbar showAdd onAdd={vi.fn()} />);
    expect(screen.getByText('+ Add Card')).toBeInTheDocument();
  });
});
