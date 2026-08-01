/**
 * @fileoverview BinderCustomizePanel — floating "Customize" button and
 * its inline editor panel, both living in the empty space to the left
 * of the closed cover (not on the cover itself).
 *
 * Shown only while the binder is closed (isCover). The button toggles
 * to the panel via isEditingCover (from useBinderCoverEditor); the
 * panel edits name, cover color, page color, and a sticker together,
 * saved as one BINDER_UPDATE via handleSaveCoverEdit.
 *
 * === Page color preview === Pages are only visible once the binder
 * is open, but Customize only exists while it's closed — so there's
 * no page to preview against normally. Rather than fake it with a
 * mock rectangle, hovering the page-color field sets
 * isPreviewingPageColor, which BinderView.jsx uses to make the front
 * cover's face transparent — revealing the REAL first page
 * underneath (already mounted in the DOM behind the cover thanks to
 * the binder's own virtualization, just normally hidden by the
 * opaque cover on top of it). This shows the actual rendering, not
 * an approximation of it.
 */

import { ColorWheelPicker } from '../ui/ColorWheelPicker.jsx';
import { resolvePageColor } from '../../utils/colorUtils.js';

export function BinderCustomizePanel({
  isCover,
  // from useBinderCoverEditor
  isEditingCover,
  draftStickers,
  isUploadingSticker,
  stickerUploadError,
  draftName,
  draftColor,
  draftPageColor,
  setDraftName,
  setDraftColor,
  setDraftPageColor,
  setIsPreviewingPageColor,
  handleEnterCoverEdit,
  handleCancelCoverEdit,
  handleSaveCoverEdit,
  handleAddStickerClick,
  handleStickerFileSelected,
  stickerFileInputRef,
  MAX_STICKERS,
  // Requested directly: point out fullscreen mode the first time
  // someone customizes a binder, since it makes the whole editing
  // experience noticeably easier on a small screen — shown once per
  // account, then never again once dismissed.
  showFullscreenHint,
  onDismissFullscreenHint,
}) {
  if (!isCover) return null;

  if (!isEditingCover) {
    return (
      <div className="binder-customize-float-wrap">
        <button
          className="binder-customize-float-btn animate-float"
          onClick={handleEnterCoverEdit}
          aria-label="Customize binder"
        >
          <i className="ti ti-palette" aria-hidden="true"></i>
          <span className="binder-customize-float-btn-label">Customize</span>
        </button>
      </div>
    );
  }

  return (
    <div className="binder-customize-panel-wrap">
      <div className="binder-customize-panel animate-slide-up-fade-in">
        {showFullscreenHint && (
          <div className="binder-customize-hint">
            <span>💡 Tip: customizing is easier in fullscreen — try the ⛶ button above.</span>
            <button
              type="button"
              className="binder-customize-hint-dismiss"
              onClick={onDismissFullscreenHint}
              aria-label="Dismiss tip"
            >
              ✕
            </button>
          </div>
        )}

        <label className="binder-customize-field">
          <span>Name</span>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={60}
          />
        </label>

        <div className="binder-customize-field">
          <span>Cover Color</span>
          <ColorWheelPicker value={draftColor} onChange={setDraftColor} />
        </div>

        <div
          className="binder-customize-field"
          onMouseEnter={() => setIsPreviewingPageColor(true)}
          onMouseLeave={() => setIsPreviewingPageColor(false)}
        >
          <span>Page Color</span>
          <p className="binder-customize-field-hint">
            Hover here to see the front cover fade so you can preview your actual first page.
          </p>
          <ColorWheelPicker value={resolvePageColor(draftPageColor)} onChange={setDraftPageColor} />
        </div>

        <div className="binder-customize-field">
          <span>Sticker</span>
          <button
            type="button"
            className="binder-cover-edit-btn"
            onClick={handleAddStickerClick}
            disabled={isUploadingSticker || draftStickers.length >= MAX_STICKERS}
          >
            {isUploadingSticker ? 'Adding…' : `+ Sticker (${draftStickers.length}/${MAX_STICKERS})`}
          </button>
          {stickerUploadError && <p className="binder-cover-edit-error">{stickerUploadError}</p>}
        </div>

        <div className="binder-customize-panel-actions">
          <button type="button" className="binder-cover-edit-btn" onClick={handleCancelCoverEdit}>
            Cancel
          </button>
          <button type="button" className="binder-cover-edit-btn binder-cover-edit-btn-primary" onClick={handleSaveCoverEdit}>
            Save
          </button>
        </div>

        <input
          ref={stickerFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleStickerFileSelected}
        />
      </div>
    </div>
  );
}