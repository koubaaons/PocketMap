/**
 * @fileoverview PokemonSetsBrowser — full page listing every Pokémon
 * TCG set, replacing CollectionsView's normal content when a user
 * drills into the "Pokémon TCG" franchise tile.
 * === ISSUE #130 (redesign) ===
 *
 * The original design routed set search through a modal step with a
 * debounced network search — even at 400ms, real network latency on
 * top of that made it feel laggy and not genuinely "live". This
 * fetches every set ONCE on mount (fetchAllSets — comfortably under
 * the API's single-request cap) and filters that array client-side
 * as the user types: a plain JS .filter(), zero network calls per
 * keystroke, genuinely instant.
 *
 * === New: declutter sets ===
 * Requested directly: sort by recency (fetchAllSets already returns
 * newest-first from the API; this adds oldest-first and name sort on
 * top, client-side) and a way to auto-hide everything released
 * before a chosen year, since the full catalog is a lot of sets to
 * scroll past for someone who only collects recent ones. "Hidden"
 * sets aren't deleted or unavailable — they just don't show in the
 * main grid until restored, individually or in a batch, from the
 * Decluttered view. See useDeclutteredSets.js for why this is a
 * local-only preference rather than synced collection data.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button, EmptyState } from '../ui/index.jsx';
import { fetchAllSets } from '../../services/activeProvider.js';
import { PokemonImportModal } from '../modals/PokemonImportModal.jsx';
import { useDeclutteredSets } from '../../hooks/useDeclutteredSets.js';
import { useMultiSelect } from '../../hooks/useMultiSelect.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name',   label: 'Name A → Z'   },
];

function sortSets(sets, sortBy) {
  const copy = [...sets];
  switch (sortBy) {
    case 'oldest': return copy.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
    case 'name':   return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'newest':
    default:       return copy.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
  }
}

export function PokemonSetsBrowser({ onBack, onImportSuccess }) {
  const [allSets, setAllSets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [importingSet, setImportingSet] = useState(null);
  const [cutoffYear, setCutoffYear] = useState('');
  const [showDecluttered, setShowDecluttered] = useState(false);

  const declutteredSets = useDeclutteredSets();
  const select = useMultiSelect();

  useEffect(() => {
    let cancelled = false;
    fetchAllSets()
      .then(sets => { if (!cancelled) setAllSets(sets); })
      .catch(err => {
        console.error('[Pokemon sets browser] failed to load sets:', err);
        if (!cancelled) setLoadError('Could not load sets. Check your connection and try again.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Exit select mode whenever switching between the main grid and
  // the decluttered view — the two lists mean completely different
  // things for a bulk action (declutter vs restore), and carrying a
  // selection across that switch would apply the wrong one.
  useEffect(() => { select.exitSelectMode(); }, [showDecluttered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant client-side filter — no network call, no debounce needed.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSets;
    return allSets.filter(s =>
      s.name.toLowerCase().includes(q) || s.series?.toLowerCase().includes(q)
    );
  }, [allSets, query]);

  const visibleSets = useMemo(() => {
    const bucketed = searched.filter(s =>
      showDecluttered ? declutteredSets.declutteredIds.has(s.id) : !declutteredSets.declutteredIds.has(s.id)
    );
    return sortSets(bucketed, sortBy);
  }, [searched, sortBy, showDecluttered, declutteredSets.declutteredIds]);

  const handleDeclutterBeforeYear = () => {
    const year = parseInt(cutoffYear, 10);
    if (!Number.isInteger(year)) return;
    const matchingIds = allSets
      .filter(s => s.releaseDate && new Date(s.releaseDate).getFullYear() < year)
      .map(s => s.id);
    if (matchingIds.length > 0) declutteredSets.declutter(matchingIds);
    setCutoffYear('');
  };

  return (
    <div className="view">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <p className="section-subtitle" style={{ margin: 0 }}>
            {showDecluttered ? 'Decluttered Sets' : 'Pokémon TCG Sets'}
          </p>
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={() => setShowDecluttered(v => !v)}
        >
          {showDecluttered ? '← Back to all sets' : `Decluttered (${declutteredSets.declutteredIds.size})`}
        </Button>
      </div>

      <div className="search-bar-wrapper" style={{ marginBottom: 16 }}>
        <span className="search-icon">◎</span>
        <input
          className="search-input"
          placeholder="Search sets…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search Pokémon sets"
          autoFocus
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
        )}
      </div>

      <div className="pokemon-sets-toolbar">
        <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {!showDecluttered && (
          <div className="pokemon-sets-declutter-cutoff">
            <label htmlFor="declutter-year">Hide sets before</label>
            <input
              id="declutter-year"
              type="number"
              className="form-input"
              placeholder="e.g. 2020"
              value={cutoffYear}
              onChange={e => setCutoffYear(e.target.value)}
              style={{ width: 90 }}
            />
            <Button variant="ghost" size="sm" onClick={handleDeclutterBeforeYear} disabled={!cutoffYear}>
              Apply
            </Button>
          </div>
        )}

        <Button
          className="pokemon-sets-select-btn"
          variant={select.isSelectMode ? 'primary' : 'ghost'}
          size="sm"
          onClick={select.toggleSelectMode}
        >
          {select.isSelectMode ? 'Cancel Select' : 'Select'}
        </Button>
      </div>

      {select.isSelectMode && (
        <div className="multiselect-bar">
          <span className="multiselect-count">{select.selectedIds.size} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={() => select.selectAll(visibleSets.map(s => s.id))}>
            Select all {visibleSets.length}
          </button>
          {select.selectedIds.size > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={select.clearSelection}>Clear</button>
          )}
          <div className="multiselect-actions">
            {showDecluttered ? (
              <button
                className="btn btn-primary btn-sm"
                disabled={select.selectedIds.size === 0}
                onClick={() => { declutteredSets.restore([...select.selectedIds]); select.exitSelectMode(); }}
              >
                Restore
              </button>
            ) : (
              <button
                className="btn btn-sm"
                disabled={select.selectedIds.size === 0}
                onClick={() => { declutteredSets.declutter([...select.selectedIds]); select.exitSelectMode(); }}
              >
                Declutter
              </button>
            )}
          </div>
          <button className="btn btn-ghost btn-sm multiselect-done" onClick={select.exitSelectMode}>Done</button>
        </div>
      )}

      {showDecluttered && declutteredSets.declutteredIds.size > 0 && !select.isSelectMode && (
        <button className="btn btn-ghost btn-sm" onClick={declutteredSets.restoreAll} style={{ marginBottom: 16 }}>
          Restore all
        </button>
      )}

      {isLoading && (
        <>
          <p className="modal-step-intro">Loading sets…</p>
          <p className="modal-step-note">Using a free, open card database — this can take a little while.</p>
        </>
      )}
      {loadError && <p className="modal-step-error">{loadError}</p>}

      {!isLoading && !loadError && visibleSets.length === 0 && (
        <EmptyState
          icon="◎"
          title={showDecluttered ? 'Nothing decluttered' : `No sets match "${query}"`}
          subtitle={showDecluttered ? 'Sets you declutter will show up here' : 'Try a different word'}
        />
      )}

      {!isLoading && !loadError && visibleSets.length > 0 && (
        <div className="pokemon-sets-grid">
          {visibleSets.map(set => {
            const isSelected = select.selectedIds.has(set.id);
            return (
              <button
                key={set.id}
                className={`pokemon-set-tile ${select.isSelectMode ? 'pokemon-set-tile-select-mode' : ''} ${isSelected ? 'pokemon-set-tile-selected' : ''}`}
                onClick={() => select.isSelectMode ? select.toggle(set.id) : setImportingSet(set)}
              >
                {select.isSelectMode && (
                  <span className={`pokemon-set-tile-checkbox ${isSelected ? 'pokemon-set-tile-checkbox-checked' : ''}`} aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                )}
                {set.images?.logo
                  ? <img src={set.images.logo} alt={set.name} className="pokemon-set-tile-logo" />
                  : <div className="pokemon-set-tile-logo-placeholder">{set.name}</div>}
                <div className="pokemon-set-tile-name">{set.name}</div>
                <div className="pokemon-set-tile-meta">
                  {set.total} cards{set.releaseDate ? ` · ${new Date(set.releaseDate).getFullYear()}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {importingSet && (
        <PokemonImportModal
          set={importingSet}
          onSubmit={(payload) => { setImportingSet(null); onImportSuccess(payload); }}
          onClose={() => setImportingSet(null)}
        />
      )}
    </div>
  );
}