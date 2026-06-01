/**
 * @fileoverview App root — composes the full application.
 *
 * Responsibilities:
 * - Reads global state via useStore
 * - Routes between views based on nav state
 * - Provides toast notifications
 * - Renders the Sidebar + main content area
 *
 * This component deliberately has NO business logic.
 * It delegates everything to views, which delegate to the store.
 */

import { useCallback } from 'react';
import { useStore, useDispatch } from './hooks/useStore.js';
import { useToast } from './hooks/useToast.js';
import { ACTIONS } from './store/index.js';
import { Sidebar } from './components/Sidebar.jsx';
import { ToastContainer, Button } from './components/ui/index.jsx';
import { AddCardModal } from './components/modals/index.jsx';
import {
  HomeView, BinderView, SearchView, FavoritesView, BinView
} from './components/views/index.jsx';

const VIEW_TITLES = {
  home:      'All Binders',
  search:    'Search Cards',
  favorites: 'Favorites',
  bin:       'Trash Bin',
};

export default function App() {
  const dispatch = useDispatch();
  const { toasts, toast, dismiss } = useToast();

  const binders = useStore(s => s.binders);
  const cards   = useStore(s => s.cards);
  const bin     = useStore(s => s.bin);
  const nav     = useStore(s => s.nav);

  const navigate = useCallback((view, binderId = null) => {
    dispatch({
      type: ACTIONS.NAV_SET,
      payload: { currentView: view, currentBinderId: binderId, currentPage: 1 },
    });
  }, [dispatch]);

  const currentBinder = binders.find(b => b.id === nav.currentBinderId) ?? null;

  // Determine topbar title
  const pageTitle = nav.currentView === 'binder'
    ? (currentBinder?.name ?? 'Binder')
    : (VIEW_TITLES[nav.currentView] ?? '');

  // Render active view
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

      default:
        return <HomeView binders={binders} cards={cards} bin={bin} toast={toast} onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar nav={nav} binders={binders} bin={bin} onNavigate={navigate} />

      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <h2 className="topbar-title">{pageTitle}</h2>
          <div className="topbar-actions">
            {nav.currentView === 'home' && (
              <Button variant="primary" size="sm" onClick={() => navigate('home')}>
                {/* handled in HomeView, this just keeps topbar clean */}
              </Button>
            )}
            {nav.currentView === 'binder' && currentBinder && (
              <AddCardButton binder={currentBinder} cards={cards} toast={toast} dispatch={dispatch} />
            )}
          </div>
        </header>

        {/* Page content */}
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
 * Has its own local modal state so it doesn't pollute App.
 */
function AddCardButton({ binder, cards, toast, dispatch }) {
  const [open, setOpen] = useCallback(
    // eslint-disable-next-line
    (() => { const { useState } = require('react'); return useState(false); })(),
    []
  );

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