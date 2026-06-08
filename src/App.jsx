/**
 * @fileoverview App root — composes the full application.
 */

import { useState, useCallback } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer, Button } from './components/ui/index.jsx';
import { AddCardModal } from './components/modals/index.js';
import { HomeView } from './components/views/HomeView.jsx';
import { BinderView } from './components/views/BinderView.jsx';
import { SearchView } from './components/views/SearchView.jsx';
import { FavoritesView } from './components/views/FavoritesView.jsx';
import { BinView } from './components/views/BinView.jsx';
import { CollectionsView } from './components/views/CollectionsView.jsx';
import { AccountView } from './components/views/AccountView.jsx';
// === ISSUE #13 START: Card Definition Management — import CollectionDetailView ===
import { CollectionDetailView } from './components/views/CollectionDetailView.jsx';
// === ISSUE #13 END ===


const VIEW_TITLES = {
  home:        'Home',
  collections: 'Collections',
  collection:  '', // title set by CollectionDetailView header
  search:      'Search Cards',
  favorites:   'Favorites',
  bin:         'Trash Bin',
  account:     'Account',
};


export default function App() {
  const dispatch = useDispatch();
  const { toasts, toast, dismiss } = useToast();

  const binders         = useStore(s => s.binders);
  const cards           = useStore(s => s.cards);
  const bin             = useStore(s => s.bin);
  const nav             = useStore(s => s.nav);
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const templateFields  = useStore(s => s.templateFields);
  const inventory       = useStore(s => s.inventory);

  const navigate = useCallback((view, id = null) => {
    dispatch({
      type: ACTIONS.NAV_SET,
      payload: {
        currentView: view,
        currentBinderId: view === 'binder' ? id : null,
        currentCollectionId: view === 'collection' ? id : null,
        currentPage: 1,
      },
    });
  }, [dispatch]);

  const currentBinder    = binders.find(b => b.id === nav.currentBinderId) ?? null;
  // === ISSUE #13 START: Card Definition Management — resolve current collection ===
  const currentCollection = collections.find(c => c.id === nav.currentCollectionId) ?? null;
  // === ISSUE #13 END ===

  const pageTitle = nav.currentView === 'binder'
    ? (currentBinder?.name ?? 'Binder')
    : (VIEW_TITLES[nav.currentView] ?? '');

  const renderView = () => {
    switch (nav.currentView) {

      case 'home':
        return <HomeView binders={binders} cards={cards} bin={bin} toast={toast} onNavigate={navigate} />;

      case 'binder':
        if (!currentBinder) { navigate('home'); return null; }
        return (
          <BinderView
            binder={currentBinder}
            cards={cards.filter(c => c.binderId === currentBinder.id)}
            allCards={cards}
            toast={toast}
          />
        );

      case 'search':
        return <SearchView cards={cards} binders={binders} toast={toast} onNavigateToBinder={(id) => navigate('binder', id)} />;

      case 'favorites':
        return <FavoritesView cards={cards} binders={binders} toast={toast} />;

      case 'bin':
        return <BinView bin={bin} binders={binders} toast={toast} />;

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

      // === ISSUE #13 START: Card Definition Management — collection detail route ===
      case 'collection':
        if (!currentCollection) { navigate('collections'); return null; }
        return (
          <CollectionDetailView
            collection={currentCollection}
            cardDefinitions={cardDefinitions}
            templateFields={templateFields}
            toast={toast}
            onBack={() => navigate('collections')}
          />
        );
      // === ISSUE #13 END ===

      case 'account':
        return <AccountView toast={toast} />;

      default:
        return <HomeView binders={binders} cards={cards} bin={bin} toast={toast} onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar nav={nav} binders={binders} bin={bin} onNavigate={navigate} />
      <div className="main-area">
        <header className="topbar">
          <h2 className="topbar-title">{pageTitle}</h2>
          <div className="topbar-actions">
            {nav.currentView === 'binder' && currentBinder && (
              <AddCardButton binder={currentBinder} cards={cards} toast={toast} dispatch={dispatch} />
            )}
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

function AddCardButton({ binder, cards, toast, dispatch }) {
  const [open, setOpen] = useState(false);
  const handleAdd = (card) => {
    dispatch({ type: ACTIONS.CARD_ADD, payload: card });
    toast(`"${card.name}" added`);
    setOpen(false);
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>+ Add Card</Button>
      {open && (
        <AddCardModal binder={binder} cards={cards} onSubmit={handleAdd} onClose={() => setOpen(false)} />
      )}
    </>
  );
}