/**
 * @fileoverview App root — composes the full application.
 */

// === ISSUE #69 START: Theme Toggle ===
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

  // === ISSUE #69: theme hook ===
  const { theme, toggleTheme, isDark } = useTheme();

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

      case 'home':
        return (
          <HomeView
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            bin={bin}
            toast={toast}
            onNavigate={navigate}
          />
        );

      case 'binders':
        return (
          <HomeView
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            bin={bin}
            toast={toast}
            onNavigate={navigate}
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
          />
        );

      case 'favorites':
        return (
          <FavoritesView
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            collections={collections}
            toast={toast}
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
        return <AccountView toast={toast} theme={theme} onToggleTheme={toggleTheme} />;

      default:
        return (
          <HomeView
            binders={binders}
            binderSlots={binderSlots}
            inventory={inventory}
            cardDefinitions={cardDefinitions}
            bin={bin}
            toast={toast}
            onNavigate={navigate}
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

// === ISSUE #69 END: Theme Toggle ===
// === ISSUE #71 END: Layout Shell ===