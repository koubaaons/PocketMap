/**
 * @fileoverview App root — composes the full application.
 */

import { useCallback } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer } from './components/ui/index.jsx';

import { HomeView }           from './components/views/HomeView.jsx';
import { SearchView }         from './components/views/SearchView.jsx';
import { CollectionsView }    from './components/views/CollectionsView.jsx';
import { CollectionDetailView } from './components/views/CollectionDetailView.jsx';
import { AccountView }        from './components/views/AccountView.jsx';
import { FavoritesView }      from './components/views/FavoritesView.jsx';

// === ISSUE #57 START: Redesigned BinView ===
import { BinView } from './components/views/BinView.jsx';
// === ISSUE #57 END ===

// === ISSUE #55 START: Binder Page View — updated BinderView ===
import { BinderView } from './components/views/BinderView.jsx';
// === ISSUE #55 END ===

const VIEW_TITLES = {
  home:        'Home',
  binder:      '',
  collections: 'Collections',
  collection:  '',
  search:      'Search Cards',
  favorites:   'Favorites',
  bin:         'Trash Bin',
  account:     'Account',
};

export default function App() {
  const dispatch = useDispatch();
  const { toasts, toast, dismiss } = useToast();

  const binders         = useStore(s => s.binders);
  const bin             = useStore(s => s.bin);
  const nav             = useStore(s => s.nav);
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);
  // === ISSUE #53 START: read binder slots from store ===
  const binderSlots     = useStore(s => s.binderSlots ?? []);
  // === ISSUE #53 END ===

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
        return <HomeView binders={binders} binderSlots={binderSlots} inventory={inventory} cardDefinitions={cardDefinitions} bin={bin} toast={toast} onNavigate={navigate} />;

      // === ISSUE #55 START: pass binderSlots and cardDefinitions to BinderView ===
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
      // === ISSUE #55 END ===

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

      // === ISSUE #57 START: updated BinView — no binders prop needed ===
      case 'bin':
        return <BinView bin={bin} toast={toast} />;
      // === ISSUE #57 END ===

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
        return <AccountView toast={toast} />;

      default:
        return <HomeView binders={binders} binderSlots={binderSlots} inventory={inventory} cardDefinitions={cardDefinitions} bin={bin} toast={toast} onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar nav={nav} binders={binders} bin={bin} onNavigate={navigate} />
      <div className="main-area">
        <header className="topbar">
          <h2 className="topbar-title">{pageTitle}</h2>
        </header>
        <main className="main-content" id="main-content">
          {renderView()}
        </main>
      </div>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}