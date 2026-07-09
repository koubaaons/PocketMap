/**
 * @fileoverview RegisterView — new user registration screen.
 *
 * Shown by App.jsx when the user is not authenticated and has chosen
 * to register. Handles:
 *   - Client-side validation (email format, password strength) before
 *     any network call is made
 *   - Supabase Auth signUp integration
 *   - Inline error messages for every failure case (invalid email,
 *     weak password, email already in use)
 *   - Success state: Supabase sends a confirmation email by default;
 *     the user is shown a "check your inbox" message
 *   - Link back to login for users who already have an account
 */

import { useState } from 'react';
import { supabase } from '../../services/supabase.js';

// Minimum password length — shown in the helper text so users know
// what to expect before they try to submit.
const MIN_PASSWORD_LENGTH = 8;

function validateEmail(email) {
  // RFC-compliant enough for UX purposes — Supabase will catch anything
  // this misses at the API level anyway.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password) {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function RegisterView({ onSwitchToLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  // Validate all fields and return true if there are no errors.
  // Errors are set into state so they render inline beside each field.
  function validate() {
    const next = {};

    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      next.email = 'Please enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    } else if (!validatePassword(password)) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (!confirm) {
      next.confirm = 'Please confirm your password.';
    } else if (password !== confirm) {
      next.confirm = 'Passwords do not match.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      // Map Supabase error messages to user-friendly inline errors.
      // The most common case is "User already registered" — shown on
      // the email field so it's clear which field the error relates to.
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already exists')) {
        setErrors({ email: 'An account with this email already exists. Try logging in instead.' });
      } else if (error.message.toLowerCase().includes('invalid email')) {
        setErrors({ email: 'Please enter a valid email address.' });
      } else if (error.message.toLowerCase().includes('password')) {
        setErrors({ password: error.message });
      } else {
        setErrors({ general: 'Something went wrong. Please try again.' });
      }
      return;
    }

    // Supabase sends a confirmation email by default. Show success state
    // rather than immediately redirecting — the user needs to confirm
    // before they can log in.
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-success-icon" aria-hidden="true">✉️</div>
          <h1 className="auth-title">Check your inbox</h1>
          <p className="auth-subtitle">
            We sent a confirmation link to <strong>{email.trim()}</strong>.
            Click it to activate your account, then come back to log in.
          </p>
          <button
            type="button"
            className="btn btn-primary auth-submit"
            onClick={onSwitchToLogin}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">📒</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start tracking your card collection.</p>

        {errors.general && (
          <p className="auth-error-banner" role="alert">{errors.general}</p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
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
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
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
            <label htmlFor="register-confirm">Confirm password</label>
            <input
              id="register-confirm"
              type="password"
              className={`form-input${errors.confirm ? ' input-error' : ''}`}
              placeholder="Repeat your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirm && (
              <p className="auth-field-error" role="alert">{errors.confirm}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Log in
          </button>
        </p>
      </div>
    </div>
  );
}