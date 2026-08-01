// @vitest-environment jsdom
/**
 * @fileoverview Tests for BinderCustomizePanel.jsx.
 *
 * Focused specifically on the new fullscreen hint — requested
 * directly to point out that customizing is easier in fullscreen
 * mode, shown once per account. Not attempting broader coverage of
 * the rest of this panel's fields (name/color/sticker editing) here.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BinderCustomizePanel } from '../BinderCustomizePanel.jsx';

function renderPanel(props) {
  return render(
    <BinderCustomizePanel
      isCover={true}
      isEditingCover={true}
      draftStickers={[]}
      isUploadingSticker={false}
      stickerUploadError={null}
      draftName="My Binder"
      draftColor="#ff0000"
      draftPageColor="#1e1e1e"
      setDraftName={() => {}}
      setDraftColor={() => {}}
      setDraftPageColor={() => {}}
      setIsPreviewingPageColor={() => {}}
      handleEnterCoverEdit={() => {}}
      handleCancelCoverEdit={() => {}}
      handleSaveCoverEdit={() => {}}
      handleAddStickerClick={() => {}}
      handleStickerFileSelected={() => {}}
      stickerFileInputRef={{ current: null }}
      MAX_STICKERS={5}
      showFullscreenHint={false}
      onDismissFullscreenHint={() => {}}
      {...props}
    />
  );
}

describe('BinderCustomizePanel — fullscreen hint (real feature)', () => {
  it('shows the fullscreen hint when showFullscreenHint is true', () => {
    renderPanel({ showFullscreenHint: true });
    expect(screen.getByText(/customizing is easier in fullscreen/)).toBeInTheDocument();
  });

  it('does not show the hint when showFullscreenHint is false — the normal, already-dismissed case', () => {
    renderPanel({ showFullscreenHint: false });
    expect(screen.queryByText(/customizing is easier in fullscreen/)).not.toBeInTheDocument();
  });

  it('dismissing the hint calls onDismissFullscreenHint', () => {
    const onDismiss = vi.fn();
    renderPanel({ showFullscreenHint: true, onDismissFullscreenHint: onDismiss });

    fireEvent.click(screen.getByLabelText('Dismiss tip'));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('the hint never shows at all while not actively editing the cover — only the floating Customize button renders in that state', () => {
    renderPanel({ isEditingCover: false, showFullscreenHint: true });

    expect(screen.queryByText(/customizing is easier in fullscreen/)).not.toBeInTheDocument();
    expect(screen.getByText('Customize')).toBeInTheDocument();
  });
});
