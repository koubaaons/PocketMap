// === ISSUE #1 START: Split Views — SearchView ===
// === ISSUE #80 START: Card Images ===
// === ISSUE #86 START: Search View Polish ===
//   - Table layout: Card / Collection / Location / Owned columns
//   - Tabs: All, Cards, Collections, Binders
//   - Collections/Binders match by name OR by containing a matching card
//   - Empty state includes an Add New Card shortcut
//
//   Table stays at 4 fixed columns even for Collection/Binder rows —
//   those just leave Location/Owned blank (—) rather than using a
//   different layout per result type.

import { useState, useMemo } from 'react';
import { EmptyState } from '../ui/index.jsx';
import { buildOwnershipMap } from '../../selectors/inventorySelectors.js';
import { getSlotForCard } from '../../selectors/binderSelectors.js';
import {
  searchCardResults,
  searchCollectionResults,
  searchBinderResults,
} from '../../selectors/searchSelectors.js';

const TABS = ['All', 'Cards', 'Collections', 'Binders'];

export function SearchView({
  cardDefinitions = [],
  collections = [],
  inventory = [],
  binders = [],
  binderSlots = [],
  toast,
  onNavigateToBinder,
  onNavigateToCollection,
}) {
  const [query, setQuery] = useState('');
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

  const cardResults       = useMemo(() => searchCardResults(cardDefinitions, query), [cardDefinitions, query]);
  const collectionResults = useMemo(() => searchCollectionResults(collections, cardDefinitions, query), [collections, cardDefinitions, query]);
  const binderResults     = useMemo(() => searchBinderResults(binders, binderSlots, cardDefinitions, query), [binders, binderSlots, cardDefinitions, query]);

  const results = useMemo(() => {
    switch (activeTab) {
      case 'Cards':       return cardResults;
      case 'Collections':  return collectionResults;
      case 'Binders':      return binderResults;
      case 'All':
      default:
        return [...cardResults, ...collectionResults, ...binderResults];
    }
  }, [activeTab, cardResults, collectionResults, binderResults]);

  const getCardLocation = (card) => {
    const isOwned = ownershipMap[card.id] !== undefined;
    if (!isOwned) return { label: 'Not owned', type: 'not-owned' };
    const slot = getSlotForCard(binderSlots, null, card.id);
    if (slot) {
      const binder = binderMap[slot.binderId];
      return {
        label: `${binder?.name ?? 'Binder'} · Page ${slot.pageNumber} · Slot ${slot.slotIndex + 1}`,
        type: 'organised',
        binderId: slot.binderId,
      };
    }
    return { label: 'Unorganised', type: 'unorganised' };
  };

  const renderRow = (result) => {
    if (result.type === 'card') {
      const { card } = result;
      const collection = collectionMap[card.collectionId];
      const isOwned    = ownershipMap[card.id] !== undefined;
      const isFav      = ownershipMap[card.id]?.is_favorite ?? false;
      const location   = getCardLocation(card);

      return (
        <tr
          key={`card-${card.id}`}
          className="search-table-row"
          onClick={() => location.binderId && onNavigateToBinder?.(location.binderId)}
        >
          <td className="search-cell search-cell-card">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} className="search-thumb" />
            ) : (
              <div className="search-thumb-placeholder" aria-hidden="true">🃏</div>
            )}
            <span className="search-card-name">
              {isFav && <span className="search-fav-dot" title="Favorite">★</span>}
              {card.name}
            </span>
          </td>
          <td className="search-cell">{collection?.name ?? '—'}</td>
          <td className="search-cell">
            <span className={`result-org-status result-org-${location.type}`}>
              {location.type === 'organised'   && '📖 '}
              {location.type === 'unorganised' && '○ '}
              {location.type === 'not-owned'   && '✕ '}
              {location.label}
            </span>
          </td>
          <td className="search-cell search-cell-owned">
            <span className={`badge ${isOwned ? 'badge-owned' : 'badge-missing'}`}>
              {isOwned ? 'Owned' : 'Not owned'}
            </span>
          </td>
        </tr>
      );
    }

    if (result.type === 'collection') {
      const { collection, matchedCardCount } = result;
      return (
        <tr
          key={`collection-${collection.id}`}
          className="search-table-row"
          onClick={() => onNavigateToCollection?.(collection.id)}
        >
          <td className="search-cell search-cell-card">
            <div className="search-thumb-placeholder" aria-hidden="true">📚</div>
            <span className="search-card-name">{collection.name}</span>
          </td>
          <td className="search-cell">—</td>
          <td className="search-cell">
            {matchedCardCount > 0 ? `${matchedCardCount} matching card${matchedCardCount !== 1 ? 's' : ''}` : '—'}
          </td>
          <td className="search-cell search-cell-owned">—</td>
        </tr>
      );
    }

    // binder
    const { binder, matchedCardCount } = result;
    return (
      <tr
        key={`binder-${binder.id}`}
        className="search-table-row"
        onClick={() => onNavigateToBinder?.(binder.id)}
      >
        <td className="search-cell search-cell-card">
          <div className="search-thumb-placeholder" aria-hidden="true">📒</div>
          <span className="search-card-name">{binder.name}</span>
        </td>
        <td className="search-cell">—</td>
        <td className="search-cell">
          {matchedCardCount > 0 ? `${matchedCardCount} matching card${matchedCardCount !== 1 ? 's' : ''}` : '—'}
        </td>
        <td className="search-cell search-cell-owned">—</td>
      </tr>
    );
  };

  return (
    <div className="view">
      <div className="search-bar-wrapper">
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search cards, collections, and binders…"
          value={query}
          onChange={e => setQuery(e.target.value)}
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
            </button>
          ))}
        </div>
      )}

      {!query && (
        <p className="search-count" style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
          Start typing to search across all {cardDefinitions.length} cards, {collections.length} collections, and {binders.length} binders…
        </p>
      )}

      {query && results.length === 0 && (
        <EmptyState
          icon="◎"
          title={`No results for "${query}"`}
          subtitle="Try a different name, or check the spelling"
        />
      )}

      {query && results.length > 0 && (
        <>
          <p className="search-count">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          <div className="search-table-wrapper">
            <table className="search-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Collection</th>
                  <th>Location</th>
                  <th>Owned</th>
                </tr>
              </thead>
              <tbody>
                {results.map(renderRow)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// === ISSUE #86 END ===
// === ISSUE #80 END: Card Images ===
// === ISSUE #1 END: Split Views — SearchView ===