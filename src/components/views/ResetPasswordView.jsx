/**
 * @fileoverview ResetPasswordView — sets a new password.
 *
 * Shown by AuthGate specifically when passwordRecovery is true (the
 * user just clicked a password-reset link and Supabase has
 * established a recovery session) — never reachable any other way.
 * Calls Supabase's updateUser with the new password, then clears the
 * recovery flag so AuthGate falls through to the normal signed-in
 * app.
 *
 * Same minimum length as RegisterView, for the same reason — kept as
 * a duplicated constant rather than shared, since these two screens
 * have no other logic in common and importing across auth views for
 * one number isn't worth the coupling.
 */

import { useState } from 'react';
import { supabase } from '../../services/supabase.js';

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordView({ onDone }) {
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (confirmPassword !== password) next.confirmPassword = 'Passwords don\'t match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrors({ general: 'Something went wrong. Please try again, or request a new reset link.' });
      return;
    }

    onDone();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">🔑</div>
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-subtitle">Choose a new password for your account.</p>

        {errors.general && (
          <p className="auth-error-banner" role="alert">{errors.general}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              className={`form-input${errors.password ? ' input-error' : ''}`}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.password && (
              <p className="auth-field-error" role="alert">{errors.password}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reset-confirm-password">Confirm new password</label>
            <input
              id="reset-confirm-password"
              type="password"
              className={`form-input${errors.confirmPassword ? ' input-error' : ''}`}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <p className="auth-field-error" role="alert">{errors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
