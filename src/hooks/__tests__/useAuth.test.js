// @vitest-environment jsdom
/**
 * @fileoverview Tests for useAuth.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockOnAuthStateChange = vi.fn();
const mockGetSession = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('../../services/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
  },
}));

const mockRunImageMigrationIfNeeded = vi.fn();
vi.mock('../../utils/migrateImagesToStorage.js', () => ({
  runImageMigrationIfNeeded: (...args) => mockRunImageMigrationIfNeeded(...args),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } });
  });

  it('starts with loading true and no user', async () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves, for this assertion
    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
  });

  it('resolves to the session user and loading:false once getSession returns a valid session', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com' };
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeUser } } });
    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(fakeUser);
  });

  it('resolves to user:null when there is no existing session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBe(null);
  });

  it('runs the image migration check for a restored session on mount, not just a fresh sign-in', async () => {
    const fakeUser = { id: 'user-1' };
    mockGetSession.mockResolvedValue({ data: { session: { user: fakeUser } } });
    const { useAuth } = await import('../useAuth.js');
    renderHook(() => useAuth());

    await waitFor(() => expect(mockRunImageMigrationIfNeeded).toHaveBeenCalledWith('user-1'));
  });

  it('does not run the image migration check when there is no session at all', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRunImageMigrationIfNeeded).not.toHaveBeenCalled();
  });

  it('updates user/loading when the auth-state-change listener fires', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    let authChangeCallback;
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const fakeUser = { id: 'user-2' };
    act(() => authChangeCallback('SIGNED_IN', { user: fakeUser }));

    await waitFor(() => expect(result.current.user).toEqual(fakeUser));
  });

  it('runs the image migration check on a SIGNED_IN event specifically', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    let authChangeCallback;
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockRunImageMigrationIfNeeded.mockClear(); // clear the mount-time call

    act(() => authChangeCallback('SIGNED_IN', { user: { id: 'user-3' } }));

    await waitFor(() => expect(mockRunImageMigrationIfNeeded).toHaveBeenCalledWith('user-3'));
  });

  it('does NOT run the image migration check on a non-SIGNED_IN event like a token refresh', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    let authChangeCallback;
    mockOnAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    const { useAuth } = await import('../useAuth.js');
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockRunImageMigrationIfNeeded.mockClear();

    act(() => authChangeCallback('TOKEN_REFRESHED', { user: { id: 'user-3' } }));

    expect(mockRunImageMigrationIfNeeded).not.toHaveBeenCalled();
  });

  it('unsubscribes from the auth listener on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { useAuth } = await import('../useAuth.js');
    const { unmount } = renderHook(() => useAuth());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  describe('passwordRecovery (real feature: password reset flow)', () => {
    it('starts as false', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const { useAuth } = await import('../useAuth.js');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.passwordRecovery).toBe(false);
    });

    it('becomes true specifically on the PASSWORD_RECOVERY event', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      let authChangeCallback;
      mockOnAuthStateChange.mockImplementation((cb) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { useAuth } = await import('../useAuth.js');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => authChangeCallback('PASSWORD_RECOVERY', { user: { id: 'user-1' } }));

      await waitFor(() => expect(result.current.passwordRecovery).toBe(true));
    });

    it('does NOT become true on an ordinary SIGNED_IN event', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      let authChangeCallback;
      mockOnAuthStateChange.mockImplementation((cb) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { useAuth } = await import('../useAuth.js');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => authChangeCallback('SIGNED_IN', { user: { id: 'user-1' } }));

      expect(result.current.passwordRecovery).toBe(false);
    });

    it('clearPasswordRecovery resets it back to false', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      let authChangeCallback;
      mockOnAuthStateChange.mockImplementation((cb) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { useAuth } = await import('../useAuth.js');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => authChangeCallback('PASSWORD_RECOVERY', { user: { id: 'user-1' } }));
      await waitFor(() => expect(result.current.passwordRecovery).toBe(true));

      act(() => result.current.clearPasswordRecovery());

      expect(result.current.passwordRecovery).toBe(false);
    });
  });
});
