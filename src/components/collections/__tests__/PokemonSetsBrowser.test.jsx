// @vitest-environment jsdom
/**
 * @fileoverview Tests for PokemonSetsBrowser.jsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PokemonSetsBrowser } from '../PokemonSetsBrowser.jsx';

beforeEach(() => {
  localStorage.clear();
});

const mockFetchAllSets = vi.fn();
vi.mock('../../../services/activeProvider.js', () => ({
  fetchAllSets: (...args) => mockFetchAllSets(...args),
}));

vi.mock('../../modals/PokemonImportModal.jsx', () => ({
  PokemonImportModal: ({ set, onClose }) => (
    <div>
      <span>Importing {set.name}</span>
      <button onClick={onClose}>Close import</button>
    </div>
  ),
}));

function makeSet(overrides = {}) {
  return { id: 'set-1', name: 'Base Set', series: 'Base', total: 102, releaseDate: '1999-01-09', images: { logo: 'https://example.com/logo.png' }, ...overrides };
}

async function renderBrowser(sets, props) {
  mockFetchAllSets.mockResolvedValue(sets);
  const utils = render(<PokemonSetsBrowser onBack={vi.fn()} onImportSuccess={vi.fn()} {...props} />);
  await waitFor(() => expect(screen.queryByText('Loading sets…')).not.toBeInTheDocument());
  return utils;
}

describe('PokemonSetsBrowser — loading', () => {
  it('shows a loading message before sets arrive', () => {
    mockFetchAllSets.mockReturnValue(new Promise(() => {}));
    render(<PokemonSetsBrowser onBack={vi.fn()} onImportSuccess={vi.fn()} />);
    expect(screen.getByText('Loading sets…')).toBeInTheDocument();
  });

  it('shows every fetched set once loaded', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' }), makeSet({ id: 'set-2', name: 'Jungle' })]);
    expect(screen.getByText('Base Set')).toBeInTheDocument();
    expect(screen.getByText('Jungle')).toBeInTheDocument();
  });

  it('shows an error message if fetching fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchAllSets.mockRejectedValue(new Error('network down'));
    render(<PokemonSetsBrowser onBack={vi.fn()} onImportSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/Could not load sets/)).toBeInTheDocument());
    consoleError.mockRestore();
  });
});

describe('PokemonSetsBrowser — search', () => {
  it('filters sets by name as the user types, with no network calls', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' }), makeSet({ id: 'set-2', name: 'Jungle' })]);
    mockFetchAllSets.mockClear();

    fireEvent.change(screen.getByLabelText('Search Pokémon sets'), { target: { value: 'jung' } });

    expect(screen.getByText('Jungle')).toBeInTheDocument();
    expect(screen.queryByText('Base Set')).not.toBeInTheDocument();
    expect(mockFetchAllSets).not.toHaveBeenCalled(); // purely client-side, no re-fetch
  });

  it('also matches on the series field, not just the set name', async () => {
    await renderBrowser([
      makeSet({ id: 'set-1', name: 'Base Set', series: 'Classic' }),
      makeSet({ id: 'set-2', name: 'Scarlet & Violet', series: 'Modern' }),
    ]);

    fireEvent.change(screen.getByLabelText('Search Pokémon sets'), { target: { value: 'classic' } });

    expect(screen.getByText('Base Set')).toBeInTheDocument();
    expect(screen.queryByText('Scarlet & Violet')).not.toBeInTheDocument();
  });
});

describe('PokemonSetsBrowser — sort', () => {
  it('sorts newest first by default', async () => {
    await renderBrowser([
      makeSet({ id: 'set-1', name: 'Old Set', releaseDate: '1999-01-01' }),
      makeSet({ id: 'set-2', name: 'New Set', releaseDate: '2024-01-01' }),
    ]);

    const names = screen.getAllByText(/Set$/).map(el => el.textContent);
    expect(names[0]).toBe('New Set');
  });

  it('sorts oldest first when selected', async () => {
    await renderBrowser([
      makeSet({ id: 'set-1', name: 'Old Set', releaseDate: '1999-01-01' }),
      makeSet({ id: 'set-2', name: 'New Set', releaseDate: '2024-01-01' }),
    ]);

    fireEvent.change(screen.getByDisplayValue('Newest first'), { target: { value: 'oldest' } });

    const names = screen.getAllByText(/Set$/).map(el => el.textContent);
    expect(names[0]).toBe('Old Set');
  });
});

describe('PokemonSetsBrowser — declutter before year', () => {
  it('declutters every set released before the chosen year, removing them from the main grid', async () => {
    await renderBrowser([
      makeSet({ id: 'set-1', name: 'Old Set', releaseDate: '1999-01-01' }),
      makeSet({ id: 'set-2', name: 'New Set', releaseDate: '2024-01-01' }),
    ]);

    fireEvent.change(screen.getByPlaceholderText('e.g. 2020'), { target: { value: '2020' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.queryByText('Old Set')).not.toBeInTheDocument();
    expect(screen.getByText('New Set')).toBeInTheDocument();
  });

  it('the Apply button is disabled with no year entered', async () => {
    await renderBrowser([makeSet()]);
    expect(screen.getByText('Apply')).toBeDisabled();
  });

  it('switching to the Decluttered view shows exactly the hidden sets, not the visible ones', async () => {
    await renderBrowser([
      makeSet({ id: 'set-1', name: 'Old Set', releaseDate: '1999-01-01' }),
      makeSet({ id: 'set-2', name: 'New Set', releaseDate: '2024-01-01' }),
    ]);
    fireEvent.change(screen.getByPlaceholderText('e.g. 2020'), { target: { value: '2020' } });
    fireEvent.click(screen.getByText('Apply'));

    fireEvent.click(screen.getByText(/Decluttered \(1\)/));

    expect(screen.getByText('Old Set')).toBeInTheDocument();
    expect(screen.queryByText('New Set')).not.toBeInTheDocument();
  });
});

describe('PokemonSetsBrowser — multiselect declutter/restore', () => {
  it('selecting sets and clicking Declutter hides them from the main grid', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' }), makeSet({ id: 'set-2', name: 'Jungle' })]);

    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Base Set'));
    fireEvent.click(screen.getByText('Declutter'));

    expect(screen.queryByText('Base Set')).not.toBeInTheDocument();
    expect(screen.getByText('Jungle')).toBeInTheDocument();
  });

  it('in the Decluttered view, selecting sets and clicking Restore brings them back to the main grid', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' })]);
    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Base Set'));
    fireEvent.click(screen.getByText('Declutter'));

    fireEvent.click(screen.getByText(/Decluttered \(1\)/));
    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Base Set'));
    fireEvent.click(screen.getByText('Restore'));

    expect(screen.getByText('Nothing decluttered')).toBeInTheDocument();
    fireEvent.click(screen.getByText('← Back to all sets'));
    expect(screen.getByText('Base Set')).toBeInTheDocument();
  });

  it('exits select mode automatically when switching between the main grid and decluttered view', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' })]);
    fireEvent.click(screen.getByText('Select'));
    expect(screen.getByText('Cancel Select')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Decluttered/));

    expect(screen.queryByText('Cancel Select')).not.toBeInTheDocument();
  });
});

describe('PokemonSetsBrowser — importing', () => {
  it('clicking a set tile (outside select mode) opens the import modal for that set', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' })]);
    fireEvent.click(screen.getByText('Base Set'));
    expect(screen.getByText('Importing Base Set')).toBeInTheDocument();
  });

  it('clicking a set tile in select mode toggles selection instead of opening the import modal', async () => {
    await renderBrowser([makeSet({ id: 'set-1', name: 'Base Set' })]);
    fireEvent.click(screen.getByText('Select'));
    fireEvent.click(screen.getByText('Base Set'));

    expect(screen.queryByText('Importing Base Set')).not.toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});
