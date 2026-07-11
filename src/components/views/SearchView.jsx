// === ISSUE #1 START: Split Views — SearchView ===
// === ISSUE #80 START: Card Images ===
// === ISSUE #86 START: Search View Polish ===

import { useStore } from '../../hooks/useStore.js';
import { useDispatch } from '../../hooks/useStore.js';
import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { CardDetailModal } from '../modals/CardDetailModal.jsx';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { getSlotForCard } from '../../selectors/binderSelectors.js';
import { useInventoryActions } from '../../hooks/useInventoryActions.js';
import { ACTIONS } from '../../store/index.js';
import {
  searchCardResults,
  searchCollectionResults,
  searchBinderResults,
} from '../../selectors/searchSelectors.js';

const TABS = ['All', 'Cards', 'Collections', 'Binders'];

export function SearchView({
  toast,
  binders = [],
  onNavigateToBinder,
  onNavigateToCollection,
}) {
  const cardDefinitions = useStore(s => s.cardDefinitions);
  const collections     = useStore(s => s.collections);
  const inventory       = useStore(s => s.inventory);
  const binderSlots     = useStore(s => s.binderSlots ?? []);
  const [query, setQuery]       = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const collectionMap = useMemo(() => {
    const map = {};
    collections.forEach(c => { map[c.id] = c; });
    return map;
  }, [collections]);

  const binderMap = useMemo(() => {
    const map = {};
    binders.forEach(b => { map[b.id] = b; });
    return map;
  }, [binders]);

  const ownershipMap = useMemo(() => buildOwnershipMap(inventory), [inventory]);

  // Only consider slots whose binder is still active (not soft-deleted).
  // Soft-deleted binders are filtered out of the store, so any slot
  // referencing a missing binder is an orphan and should be ignored.
  const activeBinderSlots = useMemo(
    () => binderSlots.filter(s => binderMap[s.binderId] !== undefined),
    [binderSlots, binderMap]
  );
  const templateFields = useStore(s => s.templateFields);
  const [viewingCard, setViewingCard] = useState(null);
  const { handleOwn, handleUnown } = useInventoryActions(toast);

  // Each result type is computed separately so tabs filter correctly
  const cardResults       = useMemo(() => searchCardResults(cardDefinitions, query),                         [cardDefinitions, query]);
  const collectionResults = useMemo(() => searchCollectionResults(collections, cardDefinitions, query),       [collections, cardDefinitions, query]);
  const binderResults     = useMemo(() => searchBinderResults(binders, activeBinderSlots, cardDefinitions, query), [binders, activeBinderSlots, cardDefinitions, query]);

  // Tab filtering — each tab only shows its own type
  const results = useMemo(() => {
    switch (activeTab) {
      case 'Cards':       return cardResults;
      case 'Collections': return collectionResults;
      case 'Binders':     return binderResults;
      case 'All':
      default:
        return [...cardResults, ...collectionResults, ...binderResults];
    }
  }, [activeTab, cardResults, collectionResults, binderResults]);

  // Tab counts shown in tab labels
  const counts = useMemo(() => ({
    Cards:       cardResults.length,
    Collections: collectionResults.length,
    Binders:     binderResults.length,
    All:         cardResults.length + collectionResults.length + binderResults.length,
  }), [cardResults, collectionResults, binderResults]);

  const getCardLocation = (card) => {
    const isOwned = ownershipMap[card.id] !== undefined;
    if (!isOwned) return { label: 'Not owned', type: 'not-owned' };
    const slot = getSlotForCard(activeBinderSlots, null, card.id);
    if (slot) {
      const binder = binderMap[slot.binderId];
      // If binder no longer exists (orphan slot), treat as unorganised
      if (!binder) return { label: 'Unorganised', type: 'unorganised' };
      return {
        label: `${binder.name} · p${slot.pageNumber} · slot ${slot.slotIndex + 1}`,
        type: 'organised',
        binderId: slot.binderId,
        pageNumber: slot.pageNumber,
      };
    }
    return { label: 'Unorganised', type: 'unorganised' };
  };

  // ── Row renderers ───────────────────────────────────────────────────────────

  const renderCardRow = (result) => {
    const { card } = result;
    const collection = collectionMap[card.collectionId];
    const isOwned    = ownershipMap[card.id] !== undefined;
    const isFav      = ownershipMap[card.id]?.is_favorite ?? false;
    const location   = getCardLocation(card);

    return (
      <tr
        key={`card-${card.id}`}
        className="search-table-row search-table-row-clickable"
        onClick={() => setViewingCard(card)}
      >
        <td className="search-cell search-cell-card">
          {card.image_url ? (
            <img src={card.image_url} alt={card.name} className="search-thumb" />
          ) : (
            <div className="search-thumb-placeholder" aria-hidden="true">🃏</div>
          )}
          <span className="search-card-name">
            {isFav && <span className="search-fav-dot" title="Favorite">★ </span>}
            {card.name}
          </span>
        </td>
        <td className="search-cell">
          {collection
            ? <button className="search-link" onClick={e => { e.stopPropagation(); onNavigateToCollection?.(collection.id); }}>{collection.name}</button>
            : '—'}
        </td>
        <td className="search-cell">
          {location.type === 'organised' ? (
            <button
              className="search-link search-location-link"
              onClick={e => { e.stopPropagation(); onNavigateToBinder?.(location.binderId, location.pageNumber); }}
              title={`Open ${binderMap[location.binderId]?.name ?? 'binder'}`}
            >
              📖 {location.label}
            </button>
          ) : (
            <span className={`result-org-status result-org-${location.type}`}>
              {location.type === 'unorganised' && '○ '}
              {location.type === 'not-owned'   && '✕ '}
              {location.label}
            </span>
          )}
        </td>
        <td className="search-cell search-cell-owned">
          <span className={`badge ${isOwned ? 'badge-owned' : 'badge-missing'}`}>
            {isOwned ? 'Owned' : 'Missing'}
          </span>
        </td>
      </tr>
    );
  };

  const renderCollectionRow = (result) => {
    const { collection, matchedCardCount } = result;
    const totalCards  = cardDefinitions.filter(cd => cd.collectionId === collection.id).length;
    const ownedCards  = inventory.filter(i => {
      const cd = cardDefinitions.find(c => c.id === i.cardDefId);
      return cd?.collectionId === collection.id;
    }).length;

    return (
      <tr
        key={`collection-${collection.id}`}
        className="search-table-row search-table-row-clickable"
        onClick={() => onNavigateToCollection?.(collection.id)}
      >
        <td className="search-cell search-cell-card">
          <div className="search-thumb-placeholder" aria-hidden="true">📚</div>
          <span className="search-card-name">{collection.name}</span>
        </td>
        <td className="search-cell search-cell-meta">
          {totalCards} card{totalCards !== 1 ? 's' : ''}
        </td>
        <td className="search-cell">
          {matchedCardCount > 0
            ? `${matchedCardCount} matching card${matchedCardCount !== 1 ? 's' : ''}`
            : 'Name match'}
        </td>
        <td className="search-cell search-cell-owned">
          <span className="badge badge-owned">
            {ownedCards}/{totalCards} owned
          </span>
        </td>
      </tr>
    );
  };

  const renderBinderRow = (result) => {
    const { binder, matchedCardCount } = result;
    const slotCount = binderSlots.filter(s => s.binderId === binder.id).length;
    const capacity  = binder.rows * binder.cols * binder.pages;

    return (
      <tr
        key={`binder-${binder.id}`}
        className="search-table-row search-table-row-clickable"
        onClick={() => onNavigateToBinder?.(binder.id)}
      >
        <td className="search-cell search-cell-card">
          <div
            className="search-binder-swatch"
            style={{ background: binder.cover_color }}
            aria-hidden="true"
          />
          <span className="search-card-name">{binder.name}</span>
        </td>
        <td className="search-cell search-cell-meta">
          {binder.rows}×{binder.cols} · {binder.pages}p
        </td>
        <td className="search-cell">
          {matchedCardCount > 0
            ? `${matchedCardCount} matching card${matchedCardCount !== 1 ? 's' : ''} inside`
            : 'Name match'}
        </td>
        <td className="search-cell search-cell-owned">
          <span className="badge badge-owned">
            {slotCount}/{capacity} filled
          </span>
        </td>
      </tr>
    );
  };

  const renderRow = (result) => {
    if (result.type === 'card')       return renderCardRow(result);
    if (result.type === 'collection') return renderCollectionRow(result);
    if (result.type === 'binder')     return renderBinderRow(result);
    return null;
  };

  // ── Section headings when in All tab ───────────────────────────────────────
  const renderAllResults = () => {
    const rows = [];

    if (cardResults.length > 0) {
      rows.push(
        <tr key="heading-cards" className="search-section-heading">
          <td colSpan={4}>Cards ({cardResults.length})</td>
        </tr>
      );
      cardResults.forEach(r => rows.push(renderCardRow(r)));
    }

    if (collectionResults.length > 0) {
      rows.push(
        <tr key="heading-collections" className="search-section-heading">
          <td colSpan={4}>Collections ({collectionResults.length})</td>
        </tr>
      );
      collectionResults.forEach(r => rows.push(renderCollectionRow(r)));
    }

    if (binderResults.length > 0) {
      rows.push(
        <tr key="heading-binders" className="search-section-heading">
          <td colSpan={4}>Binders ({binderResults.length})</td>
        </tr>
      );
      binderResults.forEach(r => rows.push(renderBinderRow(r)));
    }

    return rows;
  };

  // ── Column headers per tab ──────────────────────────────────────────────────
  const columnHeaders = activeTab === 'Binders'
    ? ['Binder', 'Grid', 'Match', 'Capacity']
    : activeTab === 'Collections'
    ? ['Collection', 'Cards', 'Match', 'Owned']
    : ['Card', 'Collection', 'Location', 'Owned'];

  return (
    <div className="view">
      <div className="search-bar-wrapper">
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search cards, collections, and binders…"
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveTab('All'); }}
          autoFocus
          aria-label="Search"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
        )}
      </div>

      {query && (
        <div className="tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className="tab-count">{counts[tab]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {!query && cardDefinitions.length === 0 && (
        <EmptyState
          icon="◎"
          title="Nothing to search yet"
          subtitle="Add cards to your collections first, then search for them here"
        />
      )}

      {!query && cardDefinitions.length > 0 && (
        <p className="search-count" style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          Start typing to search across all {cardDefinitions.length} cards, {collections.length} collections, and {binders.length} binders…
        </p>
      )}

      {query && counts.All === 0 && (
        <EmptyState
          icon="◎"
          title={`No results for "${query}"`}
          subtitle="Try a different name, or check the spelling"
        />
      )}

      {query && counts.All > 0 && results.length === 0 && (
        <EmptyState
          icon="◎"
          title={`No ${activeTab.toLowerCase()} match "${query}"`}
          subtitle="Try a different tab or search term"
        />
      )}

      {query && results.length > 0 && (
        <div className="search-table-wrapper">
          <table className="search-table">
            <thead>
              <tr>
                {columnHeaders.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {activeTab === 'All' ? renderAllResults() : results.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}

      {viewingCard && (
        <CardDetailModal
          card={viewingCard}
          inventoryItem={ownershipMap[viewingCard.id] ?? null}
          templateFields={templateFields}
          onOwn={() => handleOwn({ cardDefId: viewingCard.id, collectionId: viewingCard.collectionId })}
          onUnown={(itemId) => handleUnown(itemId)}
          onEdit={() => { onNavigateToCollection?.(viewingCard.collectionId); setViewingCard(null); }}
          onDelete={() => setViewingCard(null)}
          onClose={() => setViewingCard(null)}
        />
      )}
    </div>
  );
}

// === ISSUE #86 END ===
// === ISSUE #80 END: Card Images ===
// === ISSUE #1 END: Split Views — SearchView ===