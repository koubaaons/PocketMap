/**
 * @fileoverview CollectionRow — renders a single collection in the list.
 *
 * Responsible for:
 * - Collection cover image or placeholder
 * - Name, type badge, source
 * - Stats (total, owned, missing)
 * - Completion ring
 * - Three-dot actions menu
 *
 * Receives pre-computed stats via props — does zero data computation.
 */

import { CompletionRing } from './CompletionRing.jsx';

export function CollectionRow({ collection, stats, menuOpen, onToggleMenu, onView, onEdit, onDelete }) {
  return (
    <div className="collection-row">

      {/* Cover image or placeholder icon */}
      <div className="collection-row-cover" onClick={onView}>
        {collection.cover_image_url
          ? <img src={collection.cover_image_url} alt={collection.name} className="collection-cover-img" />
          : <div className="collection-cover-placeholder">◈</div>
        }
      </div>

      {/* Name, badge, source, stats */}
      <div className="collection-row-info" onClick={onView}>
        <div className="collection-row-name">
          {collection.name}
          <span className={`collection-badge ${collection.is_custom ? 'badge-custom' : 'badge-api'}`}>
            {collection.is_custom ? 'Custom' : 'API'}
          </span>
        </div>

        {collection.import_source && (
          <div className="collection-row-source">{collection.import_source}</div>
        )}

        <div className="collection-row-stats">
          <span className="cstat"><strong>{stats.total}</strong> Total</span>
          <span className="cstat cstat-owned"><strong>{stats.owned}</strong> Owned</span>
          <span className="cstat cstat-missing"><strong>{stats.missing}</strong> Missing</span>
        </div>
      </div>

      {/* Completion ring */}
      <div className="collection-row-pct" onClick={onView}>
        <CompletionRing pct={stats.pct} />
      </div>

      {/* Three-dot actions menu */}
      <div className="collection-row-menu">
        <button className="menu-trigger" onClick={onToggleMenu} aria-label="Collection actions">
          ⋯
        </button>
        {menuOpen && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={onView}>View Cards</button>
            <button className="menu-item" onClick={onEdit}>Edit Collection</button>
            {!collection.is_custom && (
              <button className="menu-item">Update from API</button>
            )}
            <button className="menu-item menu-item-danger" onClick={onDelete}>
              Delete Collection
            </button>
          </div>
        )}
      </div>

    </div>
  );
}