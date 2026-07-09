/**
 * @fileoverview App root — composes the full application.
 */

// === ISSUE #71 START: Layout Shell ===

import { useCallback } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { useTheme } from './hooks/useTheme.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer } from './components/ui/index.jsx';

import { HomeView }             from './components/views/HomeView.jsx';
import { BinderView }           from './components/views/BinderView.jsx';
import { SearchView }           from './components/views/SearchView.jsx';
import { CollectionsView }      from './components/views/CollectionsView.jsx';
import { CollectionDetailView } from './components/views/CollectionDetailView.jsx';
import { AccountView }          from './components/views/AccountView.jsx';
import { FavoritesView }        from './components/views/FavoritesView.jsx';
import { BinView }              from './components/views/BinView.jsx';

const VIEW_TITLES = {
  home:        'Home',
  binders:     'Binders',
  binder:      '',
  collections: 'Collections',
  collection:  '',
  search:      'Search',
  favorites:   'Favorites',
  bin:         'Trash Bin',
  statistics:  'Statistics',
  settings:    'Settings',
  account:     'Account',
};

export default function App() {
  const dispatch = useDispatch();
  const { toasts, toast, dismiss } = useToast();
  const { theme, toggleTheme, isDark } = useTheme();
  const nav             = useStore(s => s.nav);
  const binders         = useStore(s => s.binders);
  const bin             = useStore(s => s.bin);
  const collections     = useStore(s => s.collections);

  const navigate = useCallback((view, id = null) => {
    dispatch({
      type: ACTIONS.NAV_SET,
      payload: {
        currentView: view,
        currentBinderId:     view === 'binder'     ? id : null,
        currentCollectionId: view === 'collection' ? id : null,
        currentPage: 1,
      },
    });
  }, [dispatch]);

  const currentBinder     = binders.find(b => b.id === nav.currentBinderId)     ?? null;
  const currentCollection = collections.find(c => c.id === nav.currentCollectionId) ?? null;

  const pageTitle = nav.currentView === 'binder'
    ? (currentBinder?.name ?? 'Binder')
    : (VIEW_TITLES[nav.currentView] ?? '');

  const renderView = () => {
    switch (nav.currentView) {

      // === ISSUE #83: Home Dashboard — now passes collections (needed
      // for the derived activity feed's "Created collection" events) and
      // defaults to mode="dashboard" (5 stats, recently added, activity) ===
      case 'home':
        return (
          <HomeView
            toast={toast}
            onNavigate={navigate}
            mode="dashboard"
          />
        );

      // === ISSUE #83: "View All" on the dashboard links here. Same
      // HomeView component, mode="all-binders" — shows every binder
      // unpaginated, no stats/recently-added/activity widgets, no
      // "View All" link back to itself. ===
      case 'binders':
        return (
          <HomeView
            toast={toast}
            onNavigate={navigate}
            mode="all-binders"
          />
        );

      case 'binder':
        if (!currentBinder) { navigate('home'); return null; }
        return (
          <BinderView toast={toast} onNavigate={navigate} />
        );

      case 'search':
        return (
          <SearchView
            toast={toast}
            onNavigateToBinder={(id) => navigate('binder', id)}
            onNavigateToCollection={(id) => navigate('collection', id)}
          />
        );

      case 'favorites':
        return (
          <FavoritesView toast={toast} onNavigate={navigate} />
        );

      case 'bin':
        return <BinView toast={toast} />;

      case 'collections':
        return (
          <CollectionsView toast={toast} onNavigate={navigate} />
        );

      case 'collection':
        if (!currentCollection) { navigate('collections'); return null; }
        return (
          <CollectionDetailView
            toast={toast}
            onBack={() => navigate('collections')}
          />
        );

      case 'account':
      case 'settings':
        return <AccountView toast={toast} theme={theme} onToggleTheme={toggleTheme} />;

      default:
        return (
          <HomeView
            toast={toast}
            onNavigate={navigate}
            mode="dashboard"
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar nav={nav} binders={binders} bin={bin} onNavigate={navigate} />
      <div className="main-area">
        <header className="topbar">
          <div>
            <div className="topbar-title">{pageTitle}</div>
          </div>
          <div className="topbar-actions">
            {/* === ISSUE #69: theme toggle button === */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          {renderView()}
        </main>
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
// === ISSUE #71 END: Layout Shell ===