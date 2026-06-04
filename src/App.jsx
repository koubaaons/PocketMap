/**
 * @fileoverview App root — composes the full application.
 *
 * Responsibilities:
 * - Reads global state via useStore
 * - Routes between views based on nav state
 * - Provides toast notifications
 * - Renders the Sidebar + main content area
 */

import { useState, useCallback } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer, Button } from './components/ui/index.jsx';
import { AddCardModal } from './components/modals/index.js';

// === ISSUE #1 START: Split Views — import from individual view files ===
import { HomeView } from './components/views/HomeView.jsx';
import { BinderView } from './components/views/BinderView.jsx';
import { SearchView } from './components/views/SearchView.jsx';
import { FavoritesView } from './components/views/FavoritesView.jsx';
import { BinView } from './components/views/BinView.jsx';
import { CollectionsView } from './components/views/CollectionsView.jsx';
import { AccountView } from './components/views/AccountView.jsx';

const VIEW_TITLES = {
  home:        'Home',
  collections: 'Collections',
  search:      'Search Cards',
  favorites:   'Favorites',
  bin:         'Trash Bin',
  account:     'Account',
};
// === ISSUE #1 END: Split Views — updated VIEW_TITLES ===

export default function App() {
  const dispatch = useDispatch();
  const { toasts, toast, dismiss } = useToast();

  const binders         = useStore(s => s.binders);
  const cards           = useStore(s => s.cards);
  const bin             = useStore(s => s.bin);
  const nav             = useStore(s => s.nav);

  // === ISSUE #3 START: Collection Entity — read collection state ===
  const collections     = useStore(s => s.collections);
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const inventory       = useStore(s => s.inventory);
  // === ISSUE #3 END: Collection Entity — read collection state ===

  const navigate = useCallback((view, id = null) => {
    dispatch({
      type: ACTIONS.NAV_SET,
      payload: {
        currentView: view,
        currentBinderId: view === 'binder' ? id : null,
        // === ISSUE #3 START: Collection Entity — track currentCollectionId ===
        currentCollectionId: view === 'collection' ? id : null,
        // === ISSUE #3 END: Collection Entity — track currentCollectionId ===
        currentPage: 1,
      },
    });
  }, [dispatch]);

  const currentBinder = binders.find(b => b.id === nav.currentBinderId) ?? null;

  const pageTitle = nav.currentView === 'binder'
    ? (currentBinder?.name ?? 'Binder')
    : (VIEW_TITLES[nav.currentView] ?? '');

  const renderView = () => {
    switch (nav.currentView) {

      case 'home':
        return (
          <HomeView
            binders={binders}
            cards={cards}
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
            cards={cards.filter(c => c.binderId === currentBinder.id)}
            allCards={cards}
            toast={toast}
          />
        );

      case 'search':
        return (
          <SearchView
            cards={cards}
            binders={binders}
            toast={toast}
            onNavigateToBinder={(id) => navigate('binder', id)}
          />
        );

      case 'favorites':
        return <FavoritesView cards={cards} binders={binders} toast={toast} />;

      case 'bin':
        return <BinView bin={bin} binders={binders} toast={toast} />;

      // === ISSUE #1 START: Split Views — new route cases ===
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

      case 'account':
        return <AccountView toast={toast} />;
      // === ISSUE #1 END: Split Views — new route cases ===

      default:
        return (
          <HomeView
            binders={binders}
            cards={cards}
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
          <h2 className="topbar-title">{pageTitle}</h2>
          <div className="topbar-actions">
            {nav.currentView === 'binder' && currentBinder && (
              <AddCardButton
                binder={currentBinder}
                cards={cards}
                toast={toast}
                dispatch={dispatch}
              />
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

/**
 * Isolated "Add Card" button for the topbar in binder view.
 */
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
        <AddCardModal
          binder={binder}
          cards={cards}
          onSubmit={handleAdd}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}