/**
 * @fileoverview BinderCustomizePanel — floating "Customize" button and
 * its inline editor panel, both living in the empty space to the left
 * of the closed cover (not on the cover itself).
 *
 * Shown only while the binder is closed (isCover). The button toggles
 * to the panel via isEditingCover (from useBinderCoverEditor); the
 * panel edits name, cover color, and stickers together, saved as one
 * BINDER_UPDATE via handleSaveCoverEdit.
 */

import { BINDER_COLORS } from '../../types/index.js';

export function BinderCustomizePanel({
  isCover,
  // from useBinderCoverEditor
  isEditingCover,
  draftStickers,
  isUploadingSticker,
  stickerUploadError,
  draftName,
  draftColor,
  setDraftName,
  setDraftColor,
  handleEnterCoverEdit,
  handleCancelCoverEdit,
  handleSaveCoverEdit,
  handleAddStickerClick,
  handleStickerFileSelected,
  stickerFileInputRef,
  MAX_STICKERS,
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
          <span>Color</span>
          <div className="binder-customize-swatches">
            {BINDER_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className={`binder-customize-swatch ${draftColor === color ? 'binder-customize-swatch-selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setDraftColor(color)}
                aria-label={`Set cover color to ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="binder-customize-field">
          <span>Stickers</span>
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