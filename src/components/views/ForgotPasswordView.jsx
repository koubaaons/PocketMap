/**
 * @fileoverview ForgotPasswordView — requests a password reset email.
 *
 * Shown from LoginView's "Forgot password?" link. Asks for an email
 * address, calls Supabase's resetPasswordForEmail, and shows a "check
 * your inbox" confirmation. Uses window.location.origin for the
 * redirect target rather than a hardcoded URL, so this works
 * correctly both locally and on the deployed site without needing a
 * different build per environment.
 *
 * Deliberately shows the same "check your inbox" confirmation whether
 * or not the email actually belongs to a real account — Supabase's
 * own resetPasswordForEmail behaves the same way (it doesn't error
 * for an unknown email), which avoids letting this screen be used to
 * check which email addresses have accounts.
 */

import { useState } from 'react';
import { supabase } from '../../services/supabase.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function ForgotPasswordView({ onBackToLogin }) {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });

    setLoading(false);

    if (resetError) {
      // Supabase's default built-in email service is capped at just 2
      // emails per hour, shared across the whole project (not
      // per-user) — a real, well-documented limit, not a bug. Worth
      // telling the person clearly rather than a generic "something
      // went wrong", since "wait an hour" is genuinely the fix here.
      if (resetError.status === 429) {
        setError('Too many reset emails have been requested recently. Please wait a bit and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo" aria-hidden="true">📧</div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-subtitle">
            If an account exists for <strong>{email.trim()}</strong>, we've sent a link to reset your password.
          </p>
          <button type="button" className="btn btn-primary auth-submit" onClick={onBackToLogin}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">📒</div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Enter your email and we'll send you a link to set a new password.</p>

        {error && (
          <p className="auth-error-banner" role="alert">{error}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-switch">
          <button type="button" className="auth-switch-link" onClick={onBackToLogin} disabled={loading}>
            Back to login
          </button>
        </p>
      </div>
    </div>
  );
}
