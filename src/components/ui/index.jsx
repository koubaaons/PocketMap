/**
 * @fileoverview UI Primitive Components
 *
 * These are the atomic building blocks of the app.
 * They have NO knowledge of app state — they receive everything via props.
 * This makes them fully reusable and independently testable.
 *
 * === REFACTOR4c START: Export PlaceholderTab ===
 * PlaceholderTab is in its own file but re-exported from here
 * so imports stay consistent: import { PlaceholderTab } from '../ui/index.jsx'
 */
export { PlaceholderTab } from './PlaceholderTab.jsx';
// === REFACTOR4c END ===

import { useState, useEffect, useRef } from 'react';

// ─── Button ───────────────────────────────────────────────────────────────────

/**
 * @param {{ variant?: 'primary'|'ghost'|'danger'|'icon', size?: 'sm'|'md', children, onClick, disabled?, style?, title? }} props
 */
export function Button({ variant = 'ghost', size = 'md', children, onClick, disabled, style, title, type = 'button' }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      aria-label={typeof children === 'string' ? undefined : title}
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

export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      {subtitle && <p className="empty-subtitle">{subtitle}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
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