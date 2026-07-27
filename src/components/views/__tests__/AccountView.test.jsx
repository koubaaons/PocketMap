// @vitest-environment jsdom
/**
 * @fileoverview Tests for AccountView.jsx.
 *
 * Focused specifically on the account-deletion flow, since it's the
 * one genuinely security-sensitive action in this component — real
 * deletion now goes through the delete-account Edge Function (see
 * supabase/functions/delete-account/index.ts) rather than the old
 * stand-in that only ever cleared a local cache key and signed out,
 * leaving the real account untouched in Supabase forever.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AccountView } from '../AccountView.jsx';

const mockInvoke = vi.fn();
const mockSignOut = vi.fn();
vi.mock('../../../services/supabase.js', () => ({
  supabase: {
    functions: { invoke: (...args) => mockInvoke(...args) },
    auth: { signOut: (...args) => mockSignOut(...args) },
  },
}));

const mockClearState = vi.fn();
vi.mock('../../../store/storage.js', () => ({
  clearState: (...args) => mockClearState(...args),
}));

vi.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' }, loading: false }),
}));

function renderAccountView(props = {}) {
  return render(<AccountView toast={vi.fn()} theme="dark" onToggleTheme={vi.fn()} lastSynced={null} {...props} />);
}

describe('AccountView — account deletion', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockSignOut.mockReset().mockResolvedValue({ error: null });
    mockClearState.mockReset();
  });

  it('does not show a "Data & Storage" / "Clear All Local Data" section at all — removed entirely, stale copy and a near-no-op action', () => {
    renderAccountView();
    expect(screen.queryByText('Data & Storage')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear All Local Data')).not.toBeInTheDocument();
  });

  it('calls the delete-account Edge Function, then signs out and clears local state, on confirmed deletion', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const toast = vi.fn();
    renderAccountView({ toast });

    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Delete Account'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('delete-account'));
    expect(mockClearState).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('permanently deleted'), 'info');
  });

  it('shows an error and does NOT sign out or clear state when the Edge Function reports a failure', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'something went wrong server-side' }, error: null });
    const toast = vi.fn();
    renderAccountView({ toast });

    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Delete Account'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('something went wrong server-side'), 'error'));
    expect(mockClearState).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('shows an error and does not sign out when the function invocation itself fails (network error, function not deployed, etc.)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Function not found') });
    const toast = vi.fn();
    renderAccountView({ toast });

    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Delete Account'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('Function not found'), 'error'));
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('disables the Delete Account button while deletion is in progress', async () => {
    let resolveInvoke;
    mockInvoke.mockReturnValue(new Promise(resolve => { resolveInvoke = resolve; }));
    renderAccountView();

    fireEvent.click(screen.getByText('Delete Account'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Delete Account'));

    await waitFor(() => expect(screen.getByText('Deleting…')).toBeDisabled());

    resolveInvoke({ data: { success: true }, error: null });
  });
});