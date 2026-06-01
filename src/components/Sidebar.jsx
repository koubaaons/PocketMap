/**
 * @fileoverview Sidebar — navigation and binder list.
 * Purely presentational: receives state as props, calls onNavigate.
 */

import { ACTIONS } from '../store/index.js';
import { useDispatch } from '../hooks/useStore.js';
import { ConfirmModal } from './ui/index.jsx';
import { useState } from 'react';

const NAV_ITEMS = [
  { id: 'home',      label: 'All Binders', icon: '⊞' },
  { id: 'search',    label: 'Search',       icon: '◎' },
  { id: 'favorites', label: 'Favorites',    icon: '★' },
  { id: 'bin',       label: 'Trash Bin',    icon: '⊗' },
];

export function Sidebar({ nav, binders, bin, onNavigate }) {
  const dispatch = useDispatch();
  const [confirmDelete, setConfirmDelete] = useState(null); // binderId

  const handleDeleteBinder = (binderId) => {
    dispatch({ type: ACTIONS.BINDER_DELETE, payload: { binderId } });
    setConfirmDelete(null);
    if (nav.currentBinderId === binderId) onNavigate('home', null);
  };

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-mark">bindervault</span>
        <span className="logo-sub">card collection manager</span>
      </div>

      {/* Primary nav */}
      <nav className="sidebar-nav">
        <span className="sidebar-nav-label">Main</span>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${nav.currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id, null)}
            aria-current={nav.currentView === item.id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.id === 'bin' && bin.length > 0 && (
              <span className="nav-badge">{bin.length}</span>
            )}
          </button>
        ))}
      </nav>

      <hr className="sidebar-divider" />

      {/* Binder list */}
      <div className="sidebar-binders">
        <span className="sidebar-nav-label">My Binders</span>
        {binders.length === 0 && (
          <span className="sidebar-empty-hint">No binders yet</span>
        )}
        {binders.map(b => (
          <div
            key={b.id}
            className={`binder-nav-item ${nav.currentView === 'binder' && nav.currentBinderId === b.id ? 'active' : ''}`}
          >
            <button
              className="binder-nav-name"
              onClick={() => onNavigate('binder', b.id)}
              title={b.name}
            >
              <span className="binder-dot" />
              <span className="binder-nav-label">{b.name}</span>
            </button>
            <button
              className="binder-nav-delete"
              onClick={() => setConfirmDelete(b.id)}
              title={`Delete ${b.name}`}
              aria-label={`Delete ${b.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete Binder?"
          message={`Delete "${binders.find(b => b.id === confirmDelete)?.name}"? All its cards will be moved to trash.`}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteBinder(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </aside>
  );
}