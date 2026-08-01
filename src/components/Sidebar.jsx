/**
 * @fileoverview Sidebar — navigation sidebar with all nav items.
 *
 * Nav structure:
 *   Logo
 *   ── menu ──
 *   Home
 *   Binders
 *   Collections
 *   Favorites
 *   Library
 *   Search
 *   ── account ──
 *   Statistics
 *   Trash Bin
 *   Settings
 *   ── (spacer) ──
 *   User area
 */

// === ISSUE #70 START: Sidebar ===

const NAV_ITEMS = [
  { view: 'home',        label: 'Home',        icon: 'ti-home',       group: 'menu' },
  { view: 'binders',     label: 'Binders',     icon: 'ti-books',      group: 'menu' },
  { view: 'collections', label: 'Collections', icon: 'ti-cards',      group: 'menu' },
  { view: 'favorites',   label: 'Favorites',   icon: 'ti-heart',      group: 'menu' },
  { view: 'library',     label: 'Library',     icon: 'ti-photo',      group: 'menu' },
  { view: 'search',      label: 'Search',      icon: 'ti-search',     group: 'menu' },
  { view: 'statistics',  label: 'Statistics',  icon: 'ti-chart-bar',  group: 'account' },
  { view: 'bin',         label: 'Trash Bin',   icon: 'ti-trash',      group: 'account' },
  { view: 'settings',    label: 'Settings',    icon: 'ti-settings',   group: 'account' },
];

export function Sidebar({ nav, bin, onNavigate, user }) {
  const currentView = nav.currentView;

  const menuItems   = NAV_ITEMS.filter(i => i.group === 'menu');
  const accountItems = NAV_ITEMS.filter(i => i.group === 'account');

  const binCount = bin?.length ?? 0;

  // === Real bug fixed: this used to be hardcoded, literal placeholder
  // text ("Ons" / "ON"), never actually wired up to the real, logged-in
  // account at all -- every single account saw the same name here,
  // regardless of who was genuinely signed in. Reads from the same
  // user_metadata.display_name field AccountView.jsx's own "Save name"
  // field already writes to, falling back to the local part of the
  // email (everything before the @) for the many accounts that have
  // never set one, rather than showing nothing at all.
  const displayName = user?.user_metadata?.display_name?.trim() || user?.email?.split('@')[0] || 'Account';
  const avatarInitial = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar" aria-label="Main navigation">

      {/* Logo */}
      <div className="sidebar-logo">
        <i className="ti ti-book-2" aria-hidden="true"></i>
        Pinder<span className="sidebar-logo-accent">+</span>
      </div>

      <nav className="sidebar-nav">

        {/* Menu section */}
        <div className="section-label">menu</div>
        {menuItems.map(item => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
            aria-current={currentView === item.view ? 'page' : undefined}
          >
            <i className={`ti ${item.icon}`} aria-hidden="true"></i>
            {item.label}
          </button>
        ))}

        {/* Account section */}
        <div className="section-label">account</div>
        {accountItems.map(item => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
            aria-current={currentView === item.view ? 'page' : undefined}
          >
            <i className={`ti ${item.icon}`} aria-hidden="true"></i>
            {item.label}
            {item.view === 'bin' && binCount > 0 && (
              <span className="tab-count" style={{ marginLeft: 'auto' }}>{binCount}</span>
            )}
          </button>
        ))}

        <div className="nav-spacer" />

      </nav>

      {/* User area */}
      <div className="user-area" onClick={() => onNavigate('account')}>
        <div className="user-avatar" aria-hidden="true">{avatarInitial}</div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
          <div className="user-role">View profile</div>
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text-hint)', flexShrink: 0 }} aria-hidden="true"></i>
      </div>

    </aside>
  );
}

// === ISSUE #70 END: Sidebar ===