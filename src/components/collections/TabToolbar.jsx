/**
 * @fileoverview TabToolbar — shared search + sort toolbar for collection tabs.
 * Extracted to eliminate duplication across OwnedTab, MissingTab, UnorganisedTab.
 */

// === REFACTOR7e START: Extract TabToolbar component ===

import { CARD_SORT_OPTIONS } from '../../selectors/cardDefinitionSelectors.js';

export function TabToolbar({ query, setQuery, sort, setSort, showAdd = false, onAdd, showCardInfo, onToggleCardInfo }) {
  return (
    <div className="card-list-toolbar">
      <div className="search-bar-wrapper" style={{ flex: 1 }}>
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search cards…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search cards"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>
      <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
        {CARD_SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {onToggleCardInfo && (
        <button className="btn btn-ghost btn-sm" onClick={onToggleCardInfo}>
          {showCardInfo ? 'Hide Card Info' : 'Show Card Info'}
        </button>
      )}
      {showAdd && onAdd && (
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add Card</button>
      )}
    </div>
  );
}

// === REFACTOR7e END ===