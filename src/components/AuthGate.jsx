/**
 * @fileoverview AuthGate — wraps the app with authentication gating.
 *
 * Renders children (the full app shell) when a valid Supabase session
 * exists. Renders the Register, Login, or password-reset screens when
 * there is no session (or, for password reset specifically, when a
 * PASSWORD_RECOVERY session is active — see below). Shows nothing
 * (null) during the initial session check to prevent a flash of the
 * login screen on page reload when the user is already logged in.
 *
 * Sits in main.jsx between the StoreProvider and App — auth is resolved
 * before the app shell mounts, keeping auth logic fully outside App.jsx.
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { RegisterView } from './views/RegisterView.jsx';
import { LoginView }    from './views/LoginView.jsx';
import { ForgotPasswordView } from './views/ForgotPasswordView.jsx';
import { ResetPasswordView }  from './views/ResetPasswordView.jsx';

export function AuthGate({ children }) {
  const { user, loading, passwordRecovery, clearPasswordRecovery } = useAuth();
  const [screen, setScreen] = useState('register');

  // Still checking the existing session — render nothing to avoid a
  // flash of the login screen when the user is already authenticated.
  if (loading) return null;

  // === Requested directly: password reset flow. Checked BEFORE the
  // normal `if (user)` below, deliberately — Supabase's
  // PASSWORD_RECOVERY event (fired when the user clicks the link in
  // their reset email) still establishes a genuinely valid, truthy
  // user session. Without this check coming first, that session would
  // fall straight through to the real app instead of asking for a new
  // password, since there'd be no way to tell it apart from an
  // ordinary sign-in. ===
  if (passwordRecovery) {
    return (
      <ResetPasswordView onDone={() => { clearPasswordRecovery(); setScreen('login'); }} />
    );
  }

  // Authenticated — render the real app.
  if (user) return children;

  // Not authenticated — show register, login, or the forgot-password flow.
  if (screen === 'forgot-password') {
    return (
      <ForgotPasswordView onBackToLogin={() => setScreen('login')} />
    );
  }

  if (screen === 'login') {
    return (
      <LoginView
        onSwitchToRegister={() => setScreen('register')}
        onForgotPassword={() => setScreen('forgot-password')}
      />
    );
  }

  return (
    <RegisterView onSwitchToLogin={() => setScreen('login')} />
  );
}