/**
 * @fileoverview App root — composes the full application.
 */

// === ISSUE #71 START: Layout Shell ===

import { useCallback, lazy, Suspense, useEffect } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { useSupabaseSync } from './hooks/useSupabaseSync.js';
import { useSeedLoader } from './hooks/useSeedLoader.js';
import { useNewSetCheck } from './hooks/useNewSetCheck.js';
import { useCollectionUpdateCheck } from './hooks/useCollectionUpdateCheck.js';
import { useTheme } from './hooks/useTheme.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer, EmptyState } from './components/ui/index.jsx';
import { FeedbackButton } from './components/FeedbackButton.jsx';
import { CollectionUpdateBanner } from './components/CollectionUpdateBanner.jsx';

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
const LibraryView          = lazy(() => import('./components/views/LibraryView.jsx').then(m => ({ default: m.LibraryView })));

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
  useSeedLoader({ syncing, collections, toast });
  const { newSets: newlyDetectedSets, dismiss: dismissNewSets } = useNewSetCheck();
  const { pendingUpdates: pendingCollectionUpdates, dismiss: dismissCollectionUpdate, importNewCards } =
    useCollectionUpdateCheck({ syncing, collections, cardDefinitions });

  useEffect(() => {
    if (newlyDetectedSets.length === 0) return;
    const names = newlyDetectedSets.slice(0, 3).map(s => s.name).join(', ');
    const extra = newlyDetectedSets.length > 3 ? `, and ${newlyDetectedSets.length - 3} more` : '';
    toast(`New set${newlyDetectedSets.length > 1 ? 's' : ''} available: ${names}${extra}`, 'success', 6000);
    dismissNewSets();
  }, [newlyDetectedSets, toast, dismissNewSets]);
  const binderSlots     = useStore(s => s.binderSlots ?? []);

  const navigate = useCallback((view, id = null, page = null, autoOpenCustomize = false) => {
    dispatch({
      type: ACTIONS.NAV_SET,
      payload: {
        currentView: view,
        currentBinderId:     view === 'binder'     ? id : null,
        currentCollectionId: view === 'collection' ? id : null,
        currentPage: page ?? 1,
        // === Home's "Customize" shortcut on a binder card should land
        // on the binder closed with Customize already active, not
        // require a separate click once there. BinderView checks this
        // once on mount and clears it immediately after, so it never
        // re-triggers on a later, ordinary visit to the same binder. ===
        autoOpenCustomize,
      },
    });
  }, [dispatch]);

  const currentBinder     = binders.find(b => b.id === nav.currentBinderId)     ?? null;
  const currentCollection = collections.find(c => c.id === nav.currentCollectionId) ?? null;

  // Navigate away if current binder/collection was deleted
  // Done in useEffect to avoid calling dispatch during render
  useEffect(() => {
    if (nav.currentView === 'binder' && !currentBinder) navigate('home');
  }, [nav.currentView, currentBinder, navigate]);

  useEffect(() => {
    if (nav.currentView === 'collection' && !currentCollection) navigate('collections');
  }, [nav.currentView, currentCollection, navigate]);

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
        // Guard handled by useEffect below — return null here to avoid
        // calling navigate() during render which React disallows
        if (!currentBinder) return null;
        return (
          <BinderView
            binder={currentBinder}
            binderSlots={binderSlots.filter(s => s.binderId === currentBinder.id)}
            cardDefinitions={cardDefinitions}
            collections={collections}
            templateFields={templateFields}
            inventory={inventory}
            toast={toast}
            onNavigate={navigate}
            initialPage={nav.currentPage ?? null}
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
            onNavigateToBinder={(id, page) => navigate('binder', id, page)}
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

      case 'library':
        return <LibraryView toast={toast} />;

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
        if (!currentCollection) return null;
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

      // === Deliberately just a placeholder for now — real statistics
      // are deferred until the app's main features are stable and no
      // longer need active debugging, rather than half-building this
      // alongside everything else. Previously this fell through to
      // the default case below (silently showing Home) since no case
      // for it existed at all.
      case 'statistics':
        return (
          <div className="view">
            <EmptyState
              icon="📊"
              title="Statistics — in progress"
              subtitle="This page isn't built yet. It'll arrive once the rest of the app is stable."
            />
          </div>
        );

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
      <Sidebar nav={nav} bin={bin} onNavigate={navigate} />
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
      <CollectionUpdateBanner
        pendingUpdates={pendingCollectionUpdates}
        onImport={importNewCards}
        onDismiss={dismissCollectionUpdate}
        toast={toast}
      />
      <FeedbackButton toast={toast} />
    </div>
    </Suspense>
  );
}
// === ISSUE #71 END: Layout Shell ===