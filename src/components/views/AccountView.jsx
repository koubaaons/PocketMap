/**
 * @fileoverview AccountView — account management screen.
 * Currently handles data reset (clear all stored state and
 * reload), with a confirmation step before the destructive action.
 *
 * Updated in Issue #106: shows the logged-in user's email and adds
 * a logout button. Logout calls supabase.auth.signOut() which fires
 * onAuthStateChange → useAuth sets user to null → AuthGate shows the
 * login screen automatically. No manual navigation needed.
 */

import { useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { clearState } from '../../store/storage.js';
import { supabase } from '../../services/supabase.js';
import { useAuth } from '../../hooks/useAuth.js';

export function AccountView({ toast }) {
  const { user } = useAuth();
  const [confirmReset, setConfirmReset]     = useState(false);
  const [confirmLogout, setConfirmLogout]   = useState(false);
  const [loggingOut, setLoggingOut]         = useState(false);

  const handleReset = () => {
    clearState();
    toast('All data cleared. Reloading…', 'info');
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast('Could not log out. Please try again.', 'error');
      setLoggingOut(false);
    }
    // On success, onAuthStateChange fires → useAuth sets user to null
    // → AuthGate shows LoginView automatically. No redirect needed.
  };

  return (
    <div className="view">
      <div className="section-header">
        <h3 className="section-title">Account</h3>
      </div>

      <div className="account-section">
        <h4 className="account-section-title">Profile</h4>
        {user ? (
          <p className="account-section-subtitle">{user.email}</p>
        ) : (
          <p className="account-section-subtitle">Local user — no account required</p>
        )}
      </div>

      {user && (
        <div className="account-section">
          <h4 className="account-section-title">Session</h4>
          <p className="account-section-subtitle">
            You are logged in as <strong>{user.email}</strong>.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmLogout(true)}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      )}

      <div className="account-section">
        <h4 className="account-section-title">Data & Storage</h4>
        <p className="account-section-subtitle">
          All data is stored locally on this device.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          Clear All Data
        </Button>
      </div>

      {confirmReset && (
        <ConfirmModal
          title="Clear all data?"
          message="This will permanently delete all your binders, cards, collections, and settings. This cannot be undone."
          confirmLabel="Clear Everything"
          onConfirm={handleReset}
          onClose={() => setConfirmReset(false)}
        />
      )}

      {confirmLogout && (
        <ConfirmModal
          title="Log out?"
          message="You will be returned to the login screen. Your data stays saved."
          confirmLabel="Log out"
          onConfirm={handleLogout}
          onClose={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}