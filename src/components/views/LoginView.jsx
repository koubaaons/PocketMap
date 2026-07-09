/**
 * @fileoverview LoginView — placeholder for Issue #106.
 *
 * The real login form (email/password, session persistence, Supabase
 * signIn) is built in Issue #106. This placeholder exists so the
 * Register ↔ Login switcher in RegisterView works without a broken
 * link during this issue.
 */

export function LoginView({ onSwitchToRegister }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true">📒</div>
        <h1 className="auth-title">Log in</h1>
        <p className="auth-subtitle">Login is coming in the next issue.</p>
        <p className="auth-switch">
          Don't have an account?{' '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={onSwitchToRegister}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}