// @vitest-environment jsdom
/**
 * @fileoverview Tests for useSupabaseSync.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockDispatch = vi.fn();
vi.mock('../useStore.js', () => ({
  useDispatch: () => mockDispatch,
}));

let mockUser = null;
vi.mock('../useAuth.js', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

const mockLoadStateFromSupabase = vi.fn();
vi.mock('../../store/supabaseStorage.js', () => ({
  loadStateFromSupabase: (...args) => mockLoadStateFromSupabase(...args),
}));

const mockWaitForPendingSyncs = vi.fn().mockResolvedValue(undefined);
// Deliberately NOT vi.importActual('../../store/index.js') here — that
// module's real import chain reaches all the way down to
// services/supabase.js and tries to construct a real Supabase client
// (store/index.js -> supabaseSync.js -> syncHelpers.js -> supabase.js),
// which fails outside a real browser/env-configured context. ACTIONS
// is just plain string constants, so they're hardcoded here to match
// actionTypes.js exactly instead of pulling in that whole chain for them.
vi.mock('../../store/index.js', () => ({
  ACTIONS: { HYDRATE: 'HYDRATE', NAV_SET: 'NAV_SET' },
  waitForPendingSyncs: (...args) => mockWaitForPendingSyncs(...args),
}));

const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();
const mockChannel = vi.fn();
vi.mock('../../services/supabase.js', () => ({
  supabase: {
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

describe('useSupabaseSync', () => {
  beforeEach(() => {
    mockUser = null;
    mockDispatch.mockReset();
    mockLoadStateFromSupabase.mockReset();
    mockWaitForPendingSyncs.mockClear();
    mockOn.mockReset().mockReturnValue({ subscribe: mockSubscribe });
    mockSubscribe.mockReset().mockReturnValue({});
    mockChannel.mockReset().mockReturnValue({ on: mockOn });
    mockRemoveChannel.mockReset();
  });

  it('when there is no user, syncing becomes false immediately without hydrating anything', async () => {
    mockUser = null;
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { result } = renderHook(() => useSupabaseSync());

    await waitFor(() => expect(result.current.syncing).toBe(false));
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockLoadStateFromSupabase).not.toHaveBeenCalled();
  });

  it('when a user exists and the server responds, dispatches HYDRATE with the server state and sets lastSynced', async () => {
    mockUser = { id: 'user-1' };
    const serverState = { binders: [{ id: 'binder-1' }] };
    mockLoadStateFromSupabase.mockResolvedValue(serverState);
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useSupabaseSync());

    await waitFor(() => expect(result.current.syncing).toBe(false));

    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.HYDRATE, payload: serverState });
    expect(result.current.lastSynced).toBeInstanceOf(Date);
  });

  it('always resets navigation to home after the initial load, regardless of outcome', async () => {
    mockUser = { id: 'user-1' };
    mockLoadStateFromSupabase.mockResolvedValue({ binders: [] });
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useSupabaseSync());

    await waitFor(() => expect(result.current.syncing).toBe(false));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: ACTIONS.NAV_SET,
      payload: { currentView: 'home', currentBinderId: null, currentCollectionId: null, currentPage: 1 },
    });
  });

  it('does not dispatch HYDRATE when the server is unavailable, but still resets navigation and stops syncing', async () => {
    mockUser = { id: 'user-1' };
    mockLoadStateFromSupabase.mockResolvedValue(null); // unavailable — falls back to localStorage
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { ACTIONS } = await import('../../store/index.js');
    const { result } = renderHook(() => useSupabaseSync());

    await waitFor(() => expect(result.current.syncing).toBe(false));

    const hydrateCalls = mockDispatch.mock.calls.filter(([action]) => action.type === ACTIONS.HYDRATE);
    expect(hydrateCalls).toHaveLength(0);
    expect(result.current.lastSynced).toBe(null);
  });

  it('sets up a realtime channel scoped to the current user', async () => {
    mockUser = { id: 'user-42' };
    mockLoadStateFromSupabase.mockResolvedValue({ binders: [] });
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    await act(async () => { renderHook(() => useSupabaseSync()); });

    expect(mockChannel).toHaveBeenCalledWith('user-data-user-42');
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ filter: 'user_id=eq.user-42' }),
      expect.any(Function)
    );
  });

  it('does not set up any realtime channel when there is no user', async () => {
    mockUser = null;
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    renderHook(() => useSupabaseSync());

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('removes the channel on unmount', async () => {
    mockUser = { id: 'user-1' };
    mockLoadStateFromSupabase.mockResolvedValue({ binders: [] });
    const fakeSubscribedChannel = { subscribed: true };
    mockSubscribe.mockReturnValue(fakeSubscribedChannel);
    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { unmount } = renderHook(() => useSupabaseSync());

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(fakeSubscribedChannel);
  });

  it('a realtime change event waits for pending syncs, then re-fetches and hydrates after the debounce', async () => {
    vi.useFakeTimers();
    mockUser = { id: 'user-1' };
    mockLoadStateFromSupabase.mockResolvedValue({ binders: [] });

    let realtimeHandler;
    mockOn.mockImplementation((_event, _filter, handler) => {
      realtimeHandler = handler;
      return { subscribe: mockSubscribe };
    });

    const { useSupabaseSync } = await import('../useSupabaseSync.js');
    const { ACTIONS } = await import('../../store/index.js');
    renderHook(() => useSupabaseSync());

    // Let the initial-load effect settle first.
    await act(async () => { await Promise.resolve(); });
    mockDispatch.mockClear();

    const updatedState = { binders: [{ id: 'new-binder' }] };
    mockLoadStateFromSupabase.mockResolvedValue(updatedState);

    act(() => { realtimeHandler(); });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockWaitForPendingSyncs).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({ type: ACTIONS.HYDRATE, payload: updatedState });

    vi.useRealTimers();
  });
});
