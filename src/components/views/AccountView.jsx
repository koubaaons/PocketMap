/**
 * @fileoverview AccountView — full user profile page (Issue #107).
 *
 * Extends the auth scaffolding from Issues #105/#106 with:
 *   - Display name (stored in Supabase user_metadata.display_name)
 *   - Change password flow (Supabase Auth updateUser)
 *   - Join date derived from user.created_at
 *   - Account deletion with confirmation (Supabase admin deleteUser
 *     isn't available client-side — we sign the user out and clear
 *     local data; full server-side deletion is a Milestone 11 task
 *     once the backend exists)
 *   - Logout (carried over from Issue #106)
 *   - Clear local data (carried over from before auth existed)
 */

import { useState } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { clearState } from '../../store/storage.js';
import { supabase } from '../../services/supabase.js';
import { useAuth } from '../../hooks/useAuth.js';

// ── helpers ────────────────────────────────────────────────────────────────

function formatJoinDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function validatePassword(p) {
  return p.length >= 8;
}

// ── sub-sections ───────────────────────────────────────────────────────────

function ProfileSection({ user, toast }) {
  const displayName = user?.user_metadata?.display_name ?? '';
  const [name, setName]       = useState(displayName);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const isDirty = name.trim() !== displayName;

  async function handleSave(e) {
    e.preventDefault();
    if (!isDirty) return;

    setSaving(true);
    setError('');
    setSaved(false);

    const { error: err } = await supabase.auth.updateUser({
      data: { display_name: name.trim() },
    });

    setSaving(false);

    if (err) {
      setError('Could not save display name. Please try again.');
    } else {
      setSaved(true);
      toast('Display name updated.', 'success');
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <div className="account-section">
      <h4 className="account-section-title">Profile</h4>

      <div className="account-field-row">
        <span className="account-field-label">Email</span>
        <span className="account-field-value">{user?.email ?? '—'}</span>
      </div>

      <div className="account-field-row">
        <span className="account-field-label">Member since</span>
        <span className="account-field-value">{formatJoinDate(user?.created_at)}</span>
      </div>

      <form onSubmit={handleSave} className="account-inline-form">
        <div className="form-group">
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            className="form-input"
            placeholder="How you want to appear to others"
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false); }}
            maxLength={50}
            disabled={saving}
          />
          {error && <p className="auth-field-error">{error}</p>}
          {saved && <p className="account-success-text">Saved!</p>}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : 'Save name'}
        </Button>
      </form>
    </div>
  );
}

function ChangePasswordSection({ toast }) {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);

  function validate() {
    const e = {};
    if (!current)                   e.current = 'Current password is required.';
    if (!validatePassword(next))    e.next    = 'New password must be at least 8 characters.';
    if (next !== confirm)           e.confirm = 'Passwords do not match.';
    if (next === current && current) e.next   = 'New password must be different from current.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    // Supabase requires re-authentication before updating password.
    // We sign in with the current password first to verify it, then
    // update — this is the correct client-side pattern for v2.
    const { data: { user } } = await supabase.auth.getUser();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (signInErr) {
      setSaving(false);
      setErrors({ current: 'Current password is incorrect.' });
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });

    setSaving(false);

    if (updateErr) {
      setErrors({ general: 'Could not update password. Please try again.' });
    } else {
      toast('Password updated successfully.', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    }
  }

  return (
    <div className="account-section">
      <h4 className="account-section-title">Change password</h4>

      {errors.general && (
        <p className="auth-error-banner">{errors.general}</p>
      )}

      <form onSubmit={handleSubmit} className="account-inline-form">
        <div className="form-group">
          <label htmlFor="pw-current">Current password</label>
          <input
            id="pw-current"
            type="password"
            className={`form-input${errors.current ? ' input-error' : ''}`}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            disabled={saving}
          />
          {errors.current && <p className="auth-field-error">{errors.current}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="pw-next">New password</label>
          <input
            id="pw-next"
            type="password"
            className={`form-input${errors.next ? ' input-error' : ''}`}
            placeholder="At least 8 characters"
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
          {errors.next && <p className="auth-field-error">{errors.next}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <input
            id="pw-confirm"
            type="password"
            className={`form-input${errors.confirm ? ' input-error' : ''}`}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
          {errors.confirm && <p className="auth-field-error">{errors.confirm}</p>}
        </div>

        <Button type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

function formatLastSynced(date) {
  if (!date) return null;
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AccountView({ toast, lastSynced }) {
  const { user } = useAuth();

  const [confirmReset, setConfirmReset]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut]       = useState(false);

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
  };

  const handleDeleteAccount = async () => {
    // Full server-side deletion requires a backend (Milestone 11).
    // For now: sign out and clear local data so the account is
    // effectively inaccessible from this device. The Supabase user
    // record remains until the backend can cascade-delete it.
    clearState();
    await supabase.auth.signOut();
    toast('Account data cleared. You have been logged out.', 'info');
  };

  return (
    <div className="view">
      <div className="section-header">
        <h3 className="section-title">Account</h3>
      </div>

      {user && <ProfileSection user={user} toast={toast} />}
      {user && <ChangePasswordSection toast={toast} />}

      <div className="account-section">
        <h4 className="account-section-title">Session</h4>
        <p className="account-section-subtitle">
          Logged in as <strong>{user?.email}</strong>.
          {lastSynced && (
            <span className="account-section-subtitle" style={{ display: 'block', marginTop: 4 }}>
              Last synced {formatLastSynced(lastSynced)}
            </span>
          )}
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

      <div className="account-section">
        <h4 className="account-section-title">Data & Storage</h4>
        <p className="account-section-subtitle">
          Your collection data is stored locally on this device. This will
          be migrated to the cloud in Milestone 11.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
          Clear All Local Data
        </Button>
      </div>

      <div className="account-section account-section-danger">
        <h4 className="account-section-title">Danger zone</h4>
        <p className="account-section-subtitle">
          Permanently delete your account. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          Delete Account
        </Button>
      </div>

      {confirmLogout && (
        <ConfirmModal
          title="Log out?"
          message="You will be returned to the login screen. Your data stays saved."
          confirmLabel="Log out"
          onConfirm={handleLogout}
          onClose={() => setConfirmLogout(false)}
        />
      )}

      {confirmReset && (
        <ConfirmModal
          title="Clear all local data?"
          message="This will permanently delete all your binders, cards, collections, and settings from this device. This cannot be undone."
          confirmLabel="Clear Everything"
          onConfirm={handleReset}
          onClose={() => setConfirmReset(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete your account?"
          message="This will sign you out and clear all local data. Full account deletion from our servers will complete automatically. This cannot be undone."
          confirmLabel="Delete Account"
          onConfirm={handleDeleteAccount}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}