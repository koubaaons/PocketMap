/**
 * @fileoverview MultiSelectActionBar — appears once selection mode is
 * on, showing how many cards are selected plus whatever bulk actions
 * the calling tab configures (own/unown/favorite/unfavorite/declutter/
 * restore all differ per tab, so this component doesn't hardcode any
 * of them).
 */

export function MultiSelectActionBar({ count, totalAvailable, onSelectAll, onClear, onExit, actions }) {
  return (
    <div className="multiselect-bar">
      <span className="multiselect-count">{count} selected</span>

      <button className="btn btn-ghost btn-sm" onClick={onSelectAll} disabled={totalAvailable === 0}>
        Select all {totalAvailable}
      </button>
      {count > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>
      )}

      <div className="multiselect-actions">
        {actions.map(action => (
          <button
            key={action.label}
            className={`btn btn-sm ${action.variant ?? 'btn-ghost'}`}
            onClick={action.onClick}
            disabled={count === 0}
          >
            {action.label}
          </button>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm multiselect-done" onClick={onExit}>Done</button>
    </div>
  );
}