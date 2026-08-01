/**
 * @fileoverview LoginView — login screen (Issue #106).
 *
 * Replaces the placeholder from Issue #105. Handles:
 *   - Email and password fields with client-side presence validation
 *   - Supabase Auth signInWithPassword integration
 *   - Inline error messages (wrong credentials, unconfirmed email)
 *   - Loading state on submit
 *   - Link to registration for users without an account
 *
 * Session persistence is handled automatically by Supabase — it stores
 * the session in localStorage and useAuth's onAuthStateChange listener
 * picks it up on every page reload, so the user stays logged in without
 * any extra work here.
 */

import { useState } from 'react';
import { supabase } from '../../services/supabase.js';

export function LoginView({ onSwitchToRegister, onForgotPassword }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const next = {};
    if (!email.trim())  next.email    = 'Email is required.';
    if (!password)      next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      // Supabase returns "Invalid login credentials" for both wrong
      // email and wrong password — shown as a general error rather
      // than on a specific field so we don't hint which one is wrong.
      if (
        error.message.toLowerCase().includes('invalid login') ||
        error.message.toLowerCase().includes('invalid credentials')
      ) {
        setErrors({ general: 'Incorrect email or password. Please try again.' });
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
        setErrors({ general: 'Please confirm your email address before logging in. Check your inbox.' });
      } else {
        setErrors({ general: 'Something went wrong. Please try again.' });
      }
    }
    // On success, Supabase fires onAuthStateChange → useAuth updates
    // user → AuthGate renders the app. Nothing else needed here.
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">📒</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to your Pinder account.</p>

        {errors.general && (
          <p className="auth-error-banner" role="alert">{errors.general}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              className={`form-input${errors.email ? ' input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
            {errors.email && (
              <p className="auth-field-error" role="alert">{errors.email}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className={`form-input${errors.password ? ' input-error' : ''}`}
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
            {errors.password && (
              <p className="auth-field-error" role="alert">{errors.password}</p>
            )}
            <button
              type="button"
              className="auth-forgot-password-link"
              onClick={onForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToRegister}
            disabled={loading}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}