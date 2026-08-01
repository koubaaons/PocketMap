/**
 * @fileoverview UI Primitive Components
 *
 * These are the atomic building blocks of the app.
 * They have NO knowledge of app state — they receive everything via props.
 * This makes them fully reusable and independently testable.
 *
 * === ISSUE #89: Modal and Form Polish — bug fixes found during audit ===
 *   - EmptyState was rendering .empty-icon/.empty-title/.empty-subtitle/
 *     .empty-action, but components.css only defines .empty-state-icon/
 *     .empty-state-title/.empty-state-subtitle — every EmptyState in the
 *     app was unstyled. Fixed to use the classes that actually exist.
 *   - StatCard was rendering .stat-value/.stat-label, but components.css
 *     only defines .stat-card-value/.stat-card-label — every StatCard
 *     (including all 5 on the dashboard) was unstyled. Same fix.
 *   - Modal's size prop produces className modal-${size}, but
 *     components.css never defined .modal-sm — ConfirmModal passes
 *     size="sm" and was silently falling back to full .modal width.
 *     Added .modal-sm to components.css (see that file's diff).
 *
 * === REFACTOR4c START: Export PlaceholderTab ===
 * PlaceholderTab is in its own file but re-exported from here
 * so imports stay consistent: import { PlaceholderTab } from '../ui/index.jsx'
 */
export { PlaceholderTab } from './PlaceholderTab.jsx';
// === REFACTOR4c END ===

import { useEffect, useRef } from 'react';
import { useCountUp } from './useCountUp.js';

// ─── Button ───────────────────────────────────────────────────────────────────

/**
 * @param {{ variant?: 'primary'|'ghost'|'danger'|'icon', size?: 'sm'|'md', children, onClick, disabled?, style?, title? }} props
 */
export function Button({ variant = 'ghost', size = 'md', children, onClick, disabled, style, title, type = 'button', className = '', ariaLabel }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      // === Real bug fixed: an icon-only button whose children is
      // just a symbol character (e.g. "✕"/"⛶" for fullscreen) still
      // counted as a "string", so the auto-computed fallback below
      // assumed it was already descriptive enough and skipped
      // providing any accessible label at all -- a real gap for
      // anyone using a screen reader. ariaLabel lets a caller state
      // this explicitly, taking priority over the auto-computed
      // guess.
      aria-label={ariaLabel ?? (typeof children === 'string' ? undefined : title)}
    >
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * @param {{ label?: string, error?: string, id: string } & React.InputHTMLAttributes} props
 */
export function Input({ label, error, id, ...rest }) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} {...rest} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

/**
 * @param {{ label?: string, error?: string, id: string, options: {value, label, disabled?}[] } & React.SelectHTMLAttributes} props
 */
export function Select({ label, error, id, options, ...rest }) {
  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} {...rest} aria-describedby={error ? `${id}-error` : undefined}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * Accessible modal with focus trap and Escape key support.
 * @param {{ title: string, children, onClose, size?: 'sm'|'md' }} props
 */
export function Modal({ title, children, onClose, size = 'md' }) {
  const firstFocusRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    firstFocusRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`modal modal-${size}`} ref={firstFocusRef} tabIndex={-1}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <Button variant="icon" size="sm" onClick={onClose} title="Close">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Convenience wrapper for modal action row */
export function ModalActions({ children }) {
  return <div className="modal-actions">{children}</div>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

/**
 * @param {{ toasts: {id, message, type}[], dismiss: (id) => void }} props
 */
export function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          role="status"
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
// === ISSUE #89 FIX: class names corrected to match components.css
// (.empty-state-icon, not .empty-icon — etc) ===

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
// === ISSUE #89 FIX: class names corrected to match components.css
// (.stat-card-value/.stat-card-label, not .stat-value/.stat-label) ===

// === FIX (stats feeling flat/beginner-looking, and count-up animation
// wasn't visible): StatCard now accepts an optional `tone` (accent,
// info, danger, warning, success — matching the app's existing
// semantic color tokens in tokens.css, not new colors) and `icon`
// (a Tabler icon name, already loaded app-wide — see index.html) so
// each stat gets its own tinted background and icon instead of five
// identical gray boxes. Falls back to the original plain look when no
// tone is passed, so this is additive, not a breaking change for any
// other place StatCard might be used.

export function StatCard({ value, label, icon, tone }) {
  const displayValue = useCountUp(value);

  return (
    <div className={`stat-card ${tone ? `stat-card-${tone}` : ''}`}>
      {icon && <i className={`ti ${icon} stat-card-icon`} aria-hidden="true"></i>}
      <div className="stat-card-value">{displayValue}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmVariant = 'danger', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="confirm-message">{message}</p>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </ModalActions>
    </Modal>
  );
}