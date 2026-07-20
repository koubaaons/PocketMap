/**
 * @fileoverview TabToolbar — shared search + sort toolbar for collection tabs.
 * Extracted to eliminate duplication across OwnedTab, MissingTab, UnorganisedTab.
 *
 * === New: entity filters (rarity, holo effect, select/boolean custom
 * fields) === filterGroups is computed by the caller via
 * getFilterGroupsForCollection (cardDefinitionSelectors.js) — this
 * component only renders whatever groups it's handed and reports
 * changes back through setFilters. Entirely optional: omitting
 * filterGroups (or passing an empty array) just hides the control,
 * so existing callers that haven't been updated yet keep working
 * unchanged.
 */

import { useState } from 'react';
import { CARD_SORT_OPTIONS } from '../../selectors/cardDefinitionSelectors.js';
import { HOLO_LABELS } from '../../types/index.js';

export function TabToolbar({
  query, setQuery, sort, setSort, showAdd = false, onAdd, showCardInfo, onToggleCardInfo,
  filterGroups = [], filters = {}, setFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = Object.values(filters).filter(v => v !== '' && v != null).length;

  const setFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
  };

  const clearFilters = () => setFilters({});

  // Holo effect values are internal ids ('none', 'gold', etc) — show
  // their real display labels without making every OTHER filter
  // group (rarity, custom fields) also go through a label lookup.
  const labelFor = (group, option) => group.key === 'holoType' ? (HOLO_LABELS[option.value] ?? option.value) : option.label;

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

      {filterGroups.length > 0 && (
        <div className="tab-filters-wrapper">
          <button
            className={`btn btn-ghost btn-sm tab-filters-btn ${activeCount > 0 ? 'tab-filters-btn-active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          {showFilters && (
            <div className="tab-filters-popover" role="dialog" aria-label="Filter cards">
              {filterGroups.map(group => (
                <div className="form-group tab-filter-group" key={group.key}>
                  <label htmlFor={`filter-${group.key}`}>{group.label}</label>
                  <select
                    id={`filter-${group.key}`}
                    className="form-input"
                    value={filters[group.key] ?? ''}
                    onChange={e => setFilter(group.key, e.target.value)}
                  >
                    <option value="">Any</option>
                    {group.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{labelFor(group, opt)}</option>
                    ))}
                  </select>
                </div>
              ))}
              {activeCount > 0 && (
                <button className="btn btn-ghost btn-sm tab-filters-clear" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

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