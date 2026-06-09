/**
 * @fileoverview CollectionList — renders the list of collection rows.
 * Single responsibility: loop over collections and render a CollectionRow for each one.
 */
import { CollectionRow } from './CollectionRow.jsx';

export function CollectionList({
  collections,
  statsMap,
  openMenuId,
  onToggleMenu,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="collections-list">
      {collections.map(col => (
        <CollectionRow
          key={col.id}
          collection={col}
          stats={statsMap[col.id] ?? { total: 0, owned: 0, missing: 0, pct: 0 }}
          menuOpen={openMenuId === col.id}
          onToggleMenu={() => onToggleMenu(col.id)}
          onView={() => onView(col.id)}
          onEdit={() => onEdit(col)}
          onDelete={() => onDelete(col)}
        />
      ))}
    </div>
  );
}
