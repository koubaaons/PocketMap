/**
 * @fileoverview BinderTopbar — purely presentational. Takes everything
 * it needs as props; owns no state or hooks of its own. Extracted out
 * of BinderView.jsx, which had accumulated too many separate concerns
 * (page nav, fullscreen, preview mode, cover editing, slot actions,
 * keyboard shortcuts, AND rendering) to stay easy to reason about as
 * a single file.
 */

import { Button } from '../ui/index.jsx';
import { useCountUp } from '../ui/useCountUp.js';

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
    <div className="binder-topbar">
      <div className={`binder-topbar-left ${isClosed ? 'binder-topbar-disabled' : ''}`}>
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
        <div className={`binder-topbar-right-dimmable ${isClosed ? 'binder-topbar-disabled' : ''}`}>
          {isPreviewMode ? (
            <div className="binder-plan-layout-banner">
              <span className="binder-plan-layout-label">
                Planning layout — showing every card as if owned. Nothing is saved yet.
              </span>

              <Button variant="ghost" size="sm" onClick={onSwapPages}>
                Swap Pages
              </Button>

              {!isCombineMode && (
                <Button variant="ghost" size="sm" onClick={onEnterCombineMode}>
                  Combine Slots
                </Button>
              )}
              {isCombineMode && (
                <Button variant="ghost" size="sm" onClick={onExitCombineMode}>
                  Exit Combine Mode
                </Button>
              )}
              <Button variant={isLibraryPanelOpen ? 'primary' : 'ghost'} size="sm" onClick={onToggleLibraryPanel}>
                Library
              </Button>

              <Button variant="ghost" size="sm" onClick={onExitPreviewMode}>Discard</Button>
              <Button variant="primary" size="sm" onClick={onSaveLayout}>Save Layout</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={onEnterPreviewMode} disabled={isClosed}>
              Plan Layout
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onAddPage} disabled={isClosed}>+ Page</Button>

          {!isClosed && (
            <Button variant="ghost" size="sm" onClick={onToggleCardInfo}>
              {showCardInfo ? 'Hide Card Info' : 'Show Card Info'}
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onExportBinder}>
            Export
          </Button>
        </div>

        {/* Fullscreen — the one control that stays live while closed.
            Real bug fixed: this used to sit inside the dimmed wrapper
            above with only its own opacity:1/pointer-events:auto to
            fight the parent's opacity:0.35 — but opacity composites
            down an entire subtree and genuinely cannot be reversed by
            a descendant's own override, a real CSS limitation, not a
            logic bug. pointer-events:auto did correctly keep it
            clickable, but it was always going to look faded regardless
            of that override. Only a real fix: render it outside the
            dimmed wrapper entirely, as a sibling, so it's never a
            descendant of any opacity-reduced element at all. */}
        <Button variant="ghost" size="sm" onClick={onToggleFullscreen} ariaLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          {isFullscreen ? '✕' : '⛶'}
        </Button>

        <div className={`binder-topbar-right-dimmable ${isClosed ? 'binder-topbar-disabled' : ''}`}>
          <Button variant="ghost" size="sm" onClick={onCloseBinder} disabled={isClosed}>
            Close Binder
          </Button>

          <Button variant="danger" size="sm" onClick={onDeleteRequest} disabled={isClosed}>Delete</Button>
        </div>
      </div>
    </div>
  );
}