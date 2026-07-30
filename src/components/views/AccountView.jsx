/**
 * @fileoverview AccountView — full user profile page (Issue #107).
 *
 * Extends the auth scaffolding from Issues #105/#106 with:
 *   - Display name (stored in Supabase user_metadata.display_name)
 *   - Change password flow (Supabase Auth updateUser)
 *   - Join date derived from user.created_at
 *   - Account deletion with confirmation — genuinely deletes the
 *     account now, via the delete-account Edge Function (see
 *     supabase/functions/delete-account/index.ts). The previous
 *     "sign out and clear local data, real deletion is a future
 *     task" version left the actual account and all its data sitting
 *     in Supabase forever, with no indication to the user that
 *     nothing had really been deleted.
 *   - Logout (carried over from Issue #106)
 *
 * The old "Clear All Local Data" section was removed entirely — its
 * copy was stale (claiming data was only stored locally and "would be
 * migrated to the cloud" — this app has been fully Supabase-synced
 * the whole time), and the action itself only ever cleared one
 * localStorage cache key, which Supabase immediately re-populates on
 * the next successful sync anyway.
 */

import { useState, useEffect } from 'react';
import { Button, ConfirmModal } from '../ui/index.jsx';
import { clearState } from '../../store/storage.js';
import { supabase } from '../../services/supabase.js';
import { useAuth } from '../../hooks/useAuth.js';
import { getAllUsersStorageUsage, formatBytes, STORAGE_QUOTA_BYTES } from '../../services/userPreferences.js';

// Matches the email in migration 0021's RLS policy exactly — this
// gate is purely a UI convenience (don't even attempt the fetch for
// anyone else, since RLS would just correctly return their own single
// row anyway); the real access control lives in the database policy,
// not here.
const OWNER_EMAIL = 'koubaons@gmail.com';

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

// === Admin-only storage usage view — requested directly, built
// alongside the storage quota feature since it reuses the exact same
// tracked data. Only ever fetches/renders anything for the account
// matching OWNER_EMAIL; the real access control is the RLS policy
// from migration 0021 (everyone else's fetch just correctly returns
// their own single row, same as any other read in this app already
// respects RLS), this check is just a UI convenience so the fetch
// isn't even attempted for anyone else. ===
function AdminStorageSection() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllUsersStorageUsage().then(rows => { if (!cancelled) { setUsage(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="account-section">
      <h4 className="account-section-title">Storage Usage (Admin)</h4>
      <p className="account-section-subtitle">
        Every account's private storage usage — shared card art doesn't count against any
        one account, so this only reflects custom uploads (custom cards, stickers, inserts).
        Shown by user id, since email addresses aren't available from client-side code —
        cross-reference a specific id in Supabase's dashboard under Authentication → Users.
      </p>
      {loading ? (
        <p className="modal-step-note">Loading…</p>
      ) : usage.length === 0 ? (
        <p className="modal-step-note">No accounts have used any private storage yet.</p>
      ) : (
        <table className="admin-storage-table">
          <thead>
            <tr><th>User ID</th><th>Storage Used</th><th>% of Quota</th></tr>
          </thead>
          <tbody>
            {usage.map(row => (
              <tr key={row.userId}>
                <td className="admin-storage-userid">{row.userId}</td>
                <td>{formatBytes(row.storageBytesUsed)}</td>
                <td>{Math.round((row.storageBytesUsed / STORAGE_QUOTA_BYTES) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AccountView({ toast, lastSynced }) {
  const { user } = useAuth();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut]       = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast('Could not log out. Please try again.', 'error');
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    // The Edge Function is what actually deletes the account — see
    // supabase/functions/delete-account/index.ts. It deletes this
    // user's private storage files and the auth.users row itself,
    // which the database then cascades into deleting every row across
    // every table for this user automatically (migration
    // 0020_cascade_delete_user_data.sql). None of that can happen from
    // client-side code alone — deleting a user's login requires the
    // service role key, which must never reach the browser.
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || data?.error) {
      toast(`Could not delete your account: ${data?.error ?? error.message}`, 'error');
      setDeletingAccount(false);
      return;
    }

    clearState(user.id);
    await supabase.auth.signOut();
    toast('Your account has been permanently deleted.', 'info');
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

      {user?.email === OWNER_EMAIL && <AdminStorageSection />}

      <div className="account-section account-section-danger">
        <h4 className="account-section-title">Danger zone</h4>
        <p className="account-section-subtitle">
          Permanently delete your account. This cannot be undone.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={deletingAccount}>
          {deletingAccount ? 'Deleting…' : 'Delete Account'}
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

      {confirmDelete && (
        <ConfirmModal
          title="Delete your account?"
          message="This permanently deletes your account and everything in it — every binder, collection, and card. This cannot be undone."
          confirmLabel="Delete Account"
          onConfirm={handleDeleteAccount}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}