/**
 * @fileoverview BinderTopbar — purely presentational. Takes everything
 * it needs as props; owns no state or hooks of its own. Extracted out
 * of BinderView.jsx, which had accumulated too many separate concerns
 * (page nav, fullscreen, preview mode, cover editing, slot actions,
 * keyboard shortcuts, AND rendering) to stay easy to reason about as
 * a single file.
 */

import { Button, useCountUp } from '../ui/index.jsx';

export function BinderTopbar({
  binder,
  color,
  isClosed,
  filled,
  capacity,
  isPreviewMode,
  onExitPreviewMode,
  onEnterPreviewMode,
  onSaveLayout,
  onAddPage,
  onSwapPages,
  isFullscreen,
  onToggleFullscreen,
  onCloseBinder,
  onDeleteRequest,
  isCombineMode,
  onEnterCombineMode,
  onExitCombineMode,
  isLibraryPanelOpen,
  onToggleLibraryPanel,
  showCardInfo,
  onToggleCardInfo,
  onExportBinder,
}) {
  const percentComplete = capacity > 0 ? Math.round((filled / capacity) * 100) : 0;

  // Same count-up technique as the Home dashboard's stat cards.
  const displayedFilled  = useCountUp(filled);
  const displayedPages   = useCountUp(binder.pages);
  const displayedPercent = useCountUp(percentComplete);

  return (
    <div className={`binder-topbar ${isClosed ? 'binder-topbar-disabled' : ''}`}>
      <div className="binder-topbar-left">
        <div className="binder-title-accent-bar" style={{ background: color, '--accent-bar-color': color }} />
        <div>
          <span className="binder-title" style={{ color }}>{binder.name}</span>
          <div className="binder-stat-chips">
            <span className="binder-stat-chip">{displayedFilled}/{capacity} cards</span>
            <span className="binder-stat-chip">{displayedPages} pages</span>
            <span className="binder-stat-chip binder-stat-chip-pct">{displayedPercent}% complete</span>
          </div>
        </div>
      </div>
      <div className="binder-topbar-right">
        {isPreviewMode ? (
          <div className="binder-plan-layout-banner">
            <span className="binder-plan-layout-label">
              Planning layout — showing every card as if owned. Nothing is saved yet.
            </span>
            <Button variant="ghost" size="sm" onClick={onExitPreviewMode}>Discard</Button>
            <Button variant="primary" size="sm" onClick={onSaveLayout}>Save Layout</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={onEnterPreviewMode} disabled={isClosed}>
            Plan Layout
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onAddPage} disabled={isClosed}>+ Page</Button>

        {!isCombineMode && (
          <Button variant="ghost" size="sm" onClick={onSwapPages} disabled={isClosed}>
            Swap Pages
          </Button>
        )}

        {!isCombineMode && (
          <Button variant="ghost" size="sm" onClick={onEnterCombineMode} disabled={isClosed}>
            Combine Slots
          </Button>
        )}
        {isCombineMode && (
          <Button variant="ghost" size="sm" onClick={onExitCombineMode}>
            Exit Combine Mode
          </Button>
        )}
        <Button variant={isLibraryPanelOpen ? 'primary' : 'ghost'} size="sm" onClick={onToggleLibraryPanel} disabled={isClosed}>
          Library
        </Button>

        {!isClosed && (
          <Button variant="ghost" size="sm" onClick={onToggleCardInfo}>
            {showCardInfo ? 'Hide Card Info' : 'Show Card Info'}
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onExportBinder}>
          Export
        </Button>

        {/* Fullscreen — the one control that stays live while closed,
            deliberately outside the greyed-out treatment above. */}
        <Button variant="ghost" size="sm" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className="binder-topbar-always-live">
          {isFullscreen ? '✕' : '⛶'}
        </Button>

        <Button variant="ghost" size="sm" onClick={onCloseBinder} disabled={isClosed}>
          Close Binder
        </Button>

        <Button variant="danger" size="sm" onClick={onDeleteRequest} disabled={isClosed}>Delete</Button>
      </div>
    </div>
  );
}