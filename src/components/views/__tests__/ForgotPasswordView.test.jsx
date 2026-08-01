// @vitest-environment jsdom
/**
 * @fileoverview Tests for ForgotPasswordView.jsx.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForgotPasswordView } from '../ForgotPasswordView.jsx';

const mockResetPasswordForEmail = vi.fn();
vi.mock('../../../services/supabase.js', () => ({
  supabase: { auth: { resetPasswordForEmail: (...args) => mockResetPasswordForEmail(...args) } },
}));

function fillAndSubmit(email) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByText('Send reset link'));
}

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  });

  it('shows a validation error for an invalid email, without calling Supabase at all', () => {
    render(<ForgotPasswordView onBackToLogin={vi.fn()} />);

    fillAndSubmit('not-an-email');

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail with the trimmed email and window.location.origin as the redirect target — using the current origin dynamically (not a hardcoded URL) so this works correctly both locally and on the deployed site', async () => {
    render(<ForgotPasswordView onBackToLogin={vi.fn()} />);

    fillAndSubmit('  test@example.com  ');

    await waitFor(() => expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      { redirectTo: window.location.origin }
    ));
  });

  it('shows the "check your inbox" confirmation after a successful request', async () => {
    render(<ForgotPasswordView onBackToLogin={vi.fn()} />);

    fillAndSubmit('test@example.com');

    await waitFor(() => expect(screen.getByText('Check your inbox')).toBeInTheDocument());
    expect(screen.getByText(/test@example\.com/)).toBeInTheDocument();
  });

  it('shows an error message if the request fails, and stays on the form (not the confirmation)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: new Error('network error') });
    render(<ForgotPasswordView onBackToLogin={vi.fn()} />);

    fillAndSubmit('test@example.com');

    await waitFor(() => expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument());
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  });

  it('shows a specific, accurate message for a 429 rate-limit response, not the generic fallback — Supabase\'s default email service caps out at 2 emails/hour, a real, well-documented limit worth explaining clearly rather than hiding behind "something went wrong"', async () => {
    const rateLimitError = new Error('email rate limit exceeded');
    rateLimitError.status = 429;
    mockResetPasswordForEmail.mockResolvedValue({ error: rateLimitError });
    render(<ForgotPasswordView onBackToLogin={vi.fn()} />);

    fillAndSubmit('test@example.com');

    await waitFor(() => expect(screen.getByText(/Too many reset emails/)).toBeInTheDocument());
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
  });

  it('calls onBackToLogin when the back link is clicked from the form', () => {
    const onBackToLogin = vi.fn();
    render(<ForgotPasswordView onBackToLogin={onBackToLogin} />);

    fireEvent.click(screen.getByText('Back to login'));

    expect(onBackToLogin).toHaveBeenCalled();
  });

  it('calls onBackToLogin from the confirmation screen too', async () => {
    const onBackToLogin = vi.fn();
    render(<ForgotPasswordView onBackToLogin={onBackToLogin} />);

    fillAndSubmit('test@example.com');
    await waitFor(() => expect(screen.getByText('Check your inbox')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Back to login'));

    expect(onBackToLogin).toHaveBeenCalled();
  });
});
