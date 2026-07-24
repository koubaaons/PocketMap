// @vitest-environment jsdom
/**
 * @fileoverview Tests for useSeedLoader.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

let mockUser = { id: 'user-1' };
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

const mockHandleCreate = vi.fn();
vi.mock('../useCollectionActions.js', () => ({
  useCollectionActions: () => ({ handleCreate: mockHandleCreate }),
}));

const mockGetUserPreferences = vi.fn();
const mockMarkStarterCollectionSeeded = vi.fn();
vi.mock('../../services/userPreferences.js', () => ({
  getUserPreferences: (...args) => mockGetUserPreferences(...args),
  markStarterCollectionSeeded: (...args) => mockMarkStarterCollectionSeeded(...args),
}));

const mockFetchAllSets = vi.fn();
vi.mock('../../services/activeProvider.js', () => ({
  fetchAllSets: (...args) => mockFetchAllSets(...args),
}));

const mockBuildCollectionFromSet = vi.fn();
vi.mock('../../services/tcgImport.js', () => ({
  buildCollectionFromSet: (...args) => mockBuildCollectionFromSet(...args),
}));

describe('useSeedLoader', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockHandleCreate.mockReset().mockResolvedValue(undefined);
    mockGetUserPreferences.mockReset();
    mockMarkStarterCollectionSeeded.mockReset().mockResolvedValue(undefined);
    mockFetchAllSets.mockReset();
    mockBuildCollectionFromSet.mockReset();
  });

  it('does nothing while still syncing (waits for hydration to finish first)', async () => {
    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: true, collections: [], toast: vi.fn() }));

    await new Promise(r => setTimeout(r, 10));
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it('does nothing once already seeded, regardless of current collections', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: true, lastNewSetCheckAt: null, knownSetIds: [] });
    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: false, collections: [], toast: vi.fn() }));

    await waitFor(() => expect(mockGetUserPreferences).toHaveBeenCalled());
    expect(mockFetchAllSets).not.toHaveBeenCalled();
    expect(mockHandleCreate).not.toHaveBeenCalled();
  });

  it('self-heals a pre-existing account (has real collections, but no preferences row yet) without importing anything', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [] });
    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: false, collections: [{ id: 'col-1' }], toast: vi.fn() }));

    await waitFor(() => expect(mockMarkStarterCollectionSeeded).toHaveBeenCalledWith('user-1'));
    expect(mockFetchAllSets).not.toHaveBeenCalled();
    expect(mockHandleCreate).not.toHaveBeenCalled();
  });

  it('seeds a genuinely brand-new, empty account with the newest set', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [] });
    mockFetchAllSets.mockResolvedValue([
      { id: 'old-set', name: 'Old Set', releaseDate: '1999-01-01' },
      { id: 'new-set', name: 'Newest Set', releaseDate: '2026-01-01' },
    ]);
    const fakeResult = { collection: { id: 'col-1', name: 'Newest Set' }, templateFields: [{ id: 'tf1' }], cardDefinitions: [{ id: 'cd1' }] };
    mockBuildCollectionFromSet.mockResolvedValue(fakeResult);
    const toast = vi.fn();

    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: false, collections: [], toast }));

    await waitFor(() => expect(mockHandleCreate).toHaveBeenCalled());
    expect(mockBuildCollectionFromSet).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-set' }));
    expect(mockHandleCreate).toHaveBeenCalledWith(fakeResult);
    expect(mockMarkStarterCollectionSeeded).toHaveBeenCalledWith('user-1');
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Newest Set'));
  });

  it('does NOT mark as seeded if the import fails — worth retrying next time, not giving up forever', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [] });
    mockFetchAllSets.mockRejectedValue(new Error('network down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: false, collections: [], toast: vi.fn() }));

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(mockMarkStarterCollectionSeeded).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('does nothing if there is no authenticated user', async () => {
    mockUser = null;
    const { useSeedLoader } = await import('../useSeedLoader.js');
    renderHook(() => useSeedLoader({ syncing: false, collections: [], toast: vi.fn() }));

    await new Promise(r => setTimeout(r, 10));
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it('only ever runs once per mount, even if collections changes multiple times', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: true, lastNewSetCheckAt: null, knownSetIds: [] });
    const { useSeedLoader } = await import('../useSeedLoader.js');
    const { rerender } = renderHook(
      ({ collections }) => useSeedLoader({ syncing: false, collections, toast: vi.fn() }),
      { initialProps: { collections: [] } }
    );

    await waitFor(() => expect(mockGetUserPreferences).toHaveBeenCalledTimes(1));

    rerender({ collections: [{ id: 'col-1' }] });
    rerender({ collections: [{ id: 'col-1' }, { id: 'col-2' }] });

    await new Promise(r => setTimeout(r, 10));
    expect(mockGetUserPreferences).toHaveBeenCalledTimes(1);
  });
});
