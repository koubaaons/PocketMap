// @vitest-environment jsdom
/**
 * @fileoverview Tests for BinderTopbar.jsx.
 *
 * Focused specifically on the real bug just fixed: the fullscreen
 * button stayed genuinely clickable while the binder was closed
 * (pointer-events:auto correctly overrode the parent), but still
 * looked greyed out like every other disabled control, since CSS
 * opacity composites down an entire subtree and cannot be reversed by
 * a child's own opacity:1 override -- a real, well-known CSS
 * limitation, not a logic bug. The only genuine fix is structural:
 * the fullscreen button must never be a DOM descendant of whichever
 * element carries the dimming class at all. jsdom can't verify actual
 * rendered opacity/compositing, but it can verify this exact
 * structural claim directly, which is what these tests check.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BinderTopbar } from '../BinderTopbar.jsx';

function renderTopbar(props) {
  return render(
    <BinderTopbar
      binder={{ name: 'Test Binder', pages: 10 }}
      color="#ff0000"
      isClosed={false}
      filled={5}
      capacity={20}
      isPreviewMode={false}
      onExitPreviewMode={() => {}}
      onEnterPreviewMode={() => {}}
      onSaveLayout={() => {}}
      onAddPage={() => {}}
      onSwapPages={() => {}}
      isFullscreen={false}
      onToggleFullscreen={() => {}}
      onCloseBinder={() => {}}
      onDeleteRequest={() => {}}
      isCombineMode={false}
      onEnterCombineMode={() => {}}
      onExitCombineMode={() => {}}
      isLibraryPanelOpen={false}
      onToggleLibraryPanel={() => {}}
      showCardInfo={false}
      onToggleCardInfo={() => {}}
      onExportBinder={() => {}}
      {...props}
    />
  );
}

describe('BinderTopbar — fullscreen button while closed (real bug fix)', () => {
  it('the fullscreen button has no ancestor carrying the dimmed/disabled class, even while the binder is closed — the actual structural fix, since opacity cannot be reversed by a descendant no matter what that descendant\'s own class says', () => {
    renderTopbar({ isClosed: true });

    const fullscreenButton = screen.getByLabelText('Enter fullscreen');

    expect(fullscreenButton.closest('.binder-topbar-disabled')).toBeNull();
  });

  it('other, genuinely-should-be-disabled controls (Plan Layout) DO sit inside the dimmed wrapper while closed — confirms this fix is scoped to fullscreen specifically, not a blanket removal of the dimming behavior for everything', () => {
    renderTopbar({ isClosed: true });

    const planLayoutButton = screen.getByText('Plan Layout');

    expect(planLayoutButton.closest('.binder-topbar-disabled')).not.toBeNull();
  });

  it('the fullscreen button is never actually HTML-disabled either way — it was always genuinely clickable, only the visual appearance was ever broken', () => {
    renderTopbar({ isClosed: true });

    expect(screen.getByLabelText('Enter fullscreen')).not.toBeDisabled();
  });

  it('shows "Exit fullscreen" and the ✕ icon when already in fullscreen, regardless of open/closed state', () => {
    renderTopbar({ isClosed: true, isFullscreen: true });

    expect(screen.getByLabelText('Exit fullscreen')).toHaveTextContent('✕');
  });
});
