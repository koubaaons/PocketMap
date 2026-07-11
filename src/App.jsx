/**
 * @fileoverview App root — composes the full application.
 */

// === ISSUE #71 START: Layout Shell ===

import { useCallback, lazy, Suspense } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { useSupabaseSync } from './hooks/useSupabaseSync.js';
import { useTheme } from './hooks/useTheme.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer } from './components/ui/index.jsx';
import { FeedbackButton } from './components/FeedbackButton.jsx';

// Eagerly loaded — used on almost every session
import { HomeView }        from './components/views/HomeView.jsx';
import { BinderView }      from './components/views/BinderView.jsx';
import { SearchView }      from './components/views/SearchView.jsx';
import { CollectionsView } from './components/views/CollectionsView.jsx';

// Lazily loaded — only fetched when the user navigates there
const CollectionDetailView = lazy(() => import('./components/views/CollectionDetailView.jsx').then(m => ({ default: m.CollectionDetailView })));
const AccountView          = lazy(() => import('./components/views/AccountView.jsx').then(m => ({ default: m.AccountView })));
const FavoritesView        = lazy(() => import('./components/views/FavoritesView.jsx').then(m => ({ default: m.FavoritesView })));
const BinView              = lazy(() => import('./components/views/BinView.jsx').then(m => ({ default: m.BinView })));

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
  const { syncing, lastSynced } = useSupabaseSync();
  const binders         = useStore(s => s.binders);
  const bin             = useStore(s => s.bin);
  const nav             = useStore(s => s.nav);
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  const binderSlots     = useStore(s => s.binderSlots ?? []);

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
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            collections={collections}
            bin={bin}
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
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            collections={collections}
            bin={bin}
            toast={toast}
            onNavigate={navigate}
            mode="all-binders"
          />
        );

      case 'binder':
        if (!currentBinder) { navigate('home'); return null; }
        return (
          <BinderView
            binder={currentBinder}
            binderSlots={binderSlots.filter(s => s.binderId === currentBinder.id)}
            cardDefinitions={cardDefinitions}
            collections={collections}
            templateFields={templateFields}
            inventory={inventory}
            toast={toast}
          />
        );

      case 'search':
        return (
          <SearchView
            cardDefinitions={cardDefinitions}
            collections={collections}
            binderSlots={binderSlots}
            binders={binders}
            inventory={inventory}
            toast={toast}
            onNavigateToBinder={(id) => navigate('binder', id)}
            onNavigateToCollection={(id) => navigate('collection', id)}
          />
        );

      case 'favorites':
        return (
          <FavoritesView
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            collections={collections}
            toast={toast}
            onNavigate={navigate}
          />
        );

      case 'bin':
        return <BinView bin={bin} toast={toast} />;

      case 'collections':
        return (
          <CollectionsView
            collections={collections}
            cardDefinitions={cardDefinitions}
            inventory={inventory}
            toast={toast}
            onNavigate={navigate}
          />
        );

      case 'collection':
        if (!currentCollection) { navigate('collections'); return null; }
        return (
          <CollectionDetailView
            collection={currentCollection}
            cardDefinitions={cardDefinitions}
            templateFields={templateFields}
            inventory={inventory}
            binderSlots={binderSlots}
            toast={toast}
            onBack={() => navigate('collections')}
          />
        );

      case 'account':
      case 'settings':
        return <AccountView toast={toast} theme={theme} onToggleTheme={toggleTheme} lastSynced={lastSynced} />;

      default:
        return (
          <HomeView
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            collections={collections}
            bin={bin}
            toast={toast}
            onNavigate={navigate}
            mode="dashboard"
          />
        );
    }
  };

  if (syncing) {
    return (
      <div className="sync-loading">
        <div className="sync-loading-inner">
          <div className="sync-spinner" aria-hidden="true" />
          <p className="sync-loading-text">Loading your collection\u2026</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="sync-loading"><div className="sync-loading-inner"><div className="sync-spinner" /></div></div>}>
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
      <FeedbackButton toast={toast} />
    </div>
    </Suspense>
  );
}
// === ISSUE #71 END: Layout Shell ===