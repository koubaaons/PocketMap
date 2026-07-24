// @vitest-environment jsdom
/**
 * @fileoverview Tests for useNewSetCheck.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

let mockUser = { id: 'user-1' };
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

const mockGetUserPreferences = vi.fn();
const mockRecordNewSetCheck = vi.fn();
vi.mock('../../services/userPreferences.js', () => ({
  getUserPreferences: (...args) => mockGetUserPreferences(...args),
  recordNewSetCheck: (...args) => mockRecordNewSetCheck(...args),
}));

const mockFetchAllSets = vi.fn();
vi.mock('../../services/activeProvider.js', () => ({
  fetchAllSets: (...args) => mockFetchAllSets(...args),
}));

describe('useNewSetCheck', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1' };
    mockGetUserPreferences.mockReset();
    mockRecordNewSetCheck.mockReset().mockResolvedValue(undefined);
    mockFetchAllSets.mockReset();
  });

  it('reports nothing on the very first-ever check — everything would look "new" against an empty baseline', async () => {
    mockGetUserPreferences.mockResolvedValue({ seededStarterCollection: false, lastNewSetCheckAt: null, knownSetIds: [] });
    mockFetchAllSets.mockResolvedValue([{ id: 'set-1', name: 'A' }, { id: 'set-2', name: 'B' }]);

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    const { result } = renderHook(() => useNewSetCheck());

    await waitFor(() => expect(mockRecordNewSetCheck).toHaveBeenCalled());
    expect(result.current.newSets).toEqual([]);
    // But the baseline is still recorded, so future checks have
    // something real to diff against.
    expect(mockRecordNewSetCheck).toHaveBeenCalledWith('user-1', ['set-1', 'set-2']);
  });

  it('reports sets not present in known_set_ids as new, on a later check', async () => {
    mockGetUserPreferences.mockResolvedValue({
      seededStarterCollection: false,
      lastNewSetCheckAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago — due for a check
      knownSetIds: ['set-1'],
    });
    mockFetchAllSets.mockResolvedValue([{ id: 'set-1', name: 'Old' }, { id: 'set-2', name: 'Brand New Set' }]);

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    const { result } = renderHook(() => useNewSetCheck());

    await waitFor(() => expect(result.current.newSets).toHaveLength(1));
    expect(result.current.newSets[0].name).toBe('Brand New Set');
  });

  it('does not check again if less than a day has passed since the last check', async () => {
    mockGetUserPreferences.mockResolvedValue({
      seededStarterCollection: false,
      lastNewSetCheckAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago — not due yet
      knownSetIds: ['set-1'],
    });

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    renderHook(() => useNewSetCheck());

    await waitFor(() => expect(mockGetUserPreferences).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 10));
    expect(mockFetchAllSets).not.toHaveBeenCalled();
    expect(mockRecordNewSetCheck).not.toHaveBeenCalled();
  });

  it('checks again once more than a day has passed', async () => {
    mockGetUserPreferences.mockResolvedValue({
      seededStarterCollection: false,
      lastNewSetCheckAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      knownSetIds: ['set-1'],
    });
    mockFetchAllSets.mockResolvedValue([{ id: 'set-1', name: 'Old' }]);

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    renderHook(() => useNewSetCheck());

    await waitFor(() => expect(mockFetchAllSets).toHaveBeenCalled());
  });

  it('always records the check (even with no new sets found), so the daily cap advances regardless of outcome', async () => {
    mockGetUserPreferences.mockResolvedValue({
      seededStarterCollection: false,
      lastNewSetCheckAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      knownSetIds: ['set-1'],
    });
    mockFetchAllSets.mockResolvedValue([{ id: 'set-1', name: 'Old' }]); // nothing new

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    renderHook(() => useNewSetCheck());

    await waitFor(() => expect(mockRecordNewSetCheck).toHaveBeenCalledWith('user-1', ['set-1']));
  });

  it('dismiss() clears newSets', async () => {
    mockGetUserPreferences.mockResolvedValue({
      seededStarterCollection: false,
      lastNewSetCheckAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      knownSetIds: ['set-1'],
    });
    mockFetchAllSets.mockResolvedValue([{ id: 'set-1', name: 'Old' }, { id: 'set-2', name: 'New' }]);

    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    const { result } = renderHook(() => useNewSetCheck());

    await waitFor(() => expect(result.current.newSets).toHaveLength(1));
    act(() => result.current.dismiss());
    expect(result.current.newSets).toEqual([]);
  });

  it('does nothing without an authenticated user', async () => {
    mockUser = null;
    const { useNewSetCheck } = await import('../useNewSetCheck.js');
    renderHook(() => useNewSetCheck());

    await new Promise(r => setTimeout(r, 10));
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });
});
