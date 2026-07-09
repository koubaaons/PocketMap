/**
 * @fileoverview AuthGate — wraps the app with authentication gating.
 *
 * Renders children (the full app shell) when a valid Supabase session
 * exists. Renders the Register or Login screen when there is no session.
 * Shows nothing (null) during the initial session check to prevent a
 * flash of the login screen on page reload when the user is already
 * logged in.
 *
 * Sits in main.jsx between the StoreProvider and App — auth is resolved
 * before the app shell mounts, keeping auth logic fully outside App.jsx.
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { RegisterView } from './views/RegisterView.jsx';
import { LoginView }    from './views/LoginView.jsx';

export function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState('register');

  // Still checking the existing session — render nothing to avoid a
  // flash of the login screen when the user is already authenticated.
  if (loading) return null;

  // Authenticated — render the real app.
  if (user) return children;

  // Not authenticated — show register or login.
  if (screen === 'login') {
    return (
      <LoginView onSwitchToRegister={() => setScreen('register')} />
    );
  }

  return (
    <RegisterView onSwitchToLogin={() => setScreen('login')} />
  );
}