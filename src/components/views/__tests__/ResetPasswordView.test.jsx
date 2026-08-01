// @vitest-environment jsdom
/**
 * @fileoverview Tests for ResetPasswordView.jsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetPasswordView } from '../ResetPasswordView.jsx';

const mockUpdateUser = vi.fn();
vi.mock('../../../services/supabase.js', () => ({
  supabase: { auth: { updateUser: (...args) => mockUpdateUser(...args) } },
}));

function fillAndSubmit(password, confirmPassword) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirmPassword } });
  fireEvent.click(screen.getByText('Set new password'));
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset().mockResolvedValue({ error: null });
  });

  it('shows a validation error for a password under 8 characters, without calling Supabase', () => {
    render(<ResetPasswordView onDone={vi.fn()} />);

    fillAndSubmit('short', 'short');

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('shows a validation error when the two password fields don\'t match, without calling Supabase', () => {
    render(<ResetPasswordView onDone={vi.fn()} />);

    fillAndSubmit('longenoughpassword', 'differentpassword');

    expect(screen.getByText('Passwords don\'t match.')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser with the new password when validation passes', async () => {
    render(<ResetPasswordView onDone={vi.fn()} />);

    fillAndSubmit('mynewpassword123', 'mynewpassword123');

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'mynewpassword123' }));
  });

  it('calls onDone after a successful password update', async () => {
    const onDone = vi.fn();
    render(<ResetPasswordView onDone={onDone} />);

    fillAndSubmit('mynewpassword123', 'mynewpassword123');

    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('shows an error and does NOT call onDone if the update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: new Error('expired token') });
    const onDone = vi.fn();
    render(<ResetPasswordView onDone={onDone} />);

    fillAndSubmit('mynewpassword123', 'mynewpassword123');

    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
  });
});
