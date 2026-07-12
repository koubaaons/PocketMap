/**
 * @fileoverview BinderCover — renders both the front and back faces of
 * a binder cover, including in-place sticker editing controls.
 *
 * Extracted from BinderView.jsx where coverFrontContent and
 * coverBackContent lived as inline JSX variables. Accepts all cover
 * editing state and handlers from useBinderCoverEditor, keeping this
 * component purely presentational.
 *
 * === Usage ===
 * const coverEditor = useBinderCoverEditor({ binder, toast });
 * <BinderCover binder={binder} color={color} isCover={isCover} {...coverEditor} />
 *
 * BinderView then passes coverFront/coverBack to BinderBookFlip:
 * <BinderBookFlip coverFrontContent={<BinderCover ... />} ... />
 */

import { CustomizerSticker } from '../modals/CustomizerSticker.jsx';

export function BinderCoverFront({
  binder,
  color,
  isCover,
  // from useBinderCoverEditor
  coverRef,
  stickerFileInputRef,
  isEditingCover,
  draftStickers,
  selectedStickerId,
  isUploadingSticker,
  stickerUploadError,
  setSelectedStickerId,
  handleEnterCoverEdit,
  handleCancelCoverEdit,
  handleSaveCoverEdit,
  handleAddStickerClick,
  handleStickerFileSelected,
  handleChangeDraftSticker,
  handleRemoveDraftSticker,
  MAX_STICKERS,
}) {
  return (
    <div
      ref={coverRef}
      className={`binder-cover-flip binder-cover-frame ${isCover && !isEditingCover ? 'binder-cover-resting-tilt' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        // binder-cover-flip's stylesheet rule sets inset:-12px (it used
        // to be a 12px-oversized absolute hit-target around the old
        // book's cover). That class is reused here ONLY for its hover
        // selector — explicitly zeroing inset prevents that leftover
        // rule from shifting this box outward on every edge.
        inset: 0,
        backgroundColor: color,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 100%)`,
      }}
      onClick={isEditingCover ? (e) => e.stopPropagation() : undefined}
      onMouseDown={isEditingCover ? () => setSelectedStickerId(null) : undefined}
    >
      {/* === FIX (real cover never got the redesign — only the
          Home-grid mini preview did): same spine-line + sparkle motif,
          same percentage-based positions, just on the actual full-size
          cover so opening a binder feels consistent with its own
          preview instead of switching to the old plain look. Purely
          decorative (aria-hidden), rendered underneath stickers in DOM
          order so a placed sticker still visually sits on top. */}
      <span className="binder-cover-spine-line binder-cover-spine-line-1" aria-hidden="true" />
      <span className="binder-cover-spine-line binder-cover-spine-line-2" aria-hidden="true" />
      <i className="ti ti-sparkles binder-cover-sparkle binder-cover-sparkle-1" aria-hidden="true" />
      <i className="ti ti-sparkles binder-cover-sparkle binder-cover-sparkle-2" aria-hidden="true" />
      <i className="ti ti-sparkles binder-cover-sparkle binder-cover-sparkle-3" aria-hidden="true" />

      {(isEditingCover ? draftStickers : (binder.stickers ?? [])).map(sticker => (
        <CustomizerSticker
          key={sticker.id}
          sticker={sticker}
          containerRef={coverRef}
          editable={isEditingCover}
          isSelected={isEditingCover && selectedStickerId === sticker.id}
          onSelect={isEditingCover ? () => setSelectedStickerId(sticker.id) : undefined}
          onChange={isEditingCover ? (patch) => handleChangeDraftSticker(sticker.id, patch) : undefined}
          onRemove={isEditingCover ? () => handleRemoveDraftSticker(sticker.id) : undefined}
        />
      ))}

      {isCover && !isEditingCover && (
        <button
          className="binder-cover-customize-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleEnterCoverEdit();
          }}
          aria-label="Customize cover"
        >
          ✎ Customize
        </button>
      )}

      {isEditingCover && (
        <div className="binder-cover-edit-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="binder-cover-edit-btn"
            onClick={handleAddStickerClick}
            disabled={isUploadingSticker || draftStickers.length >= MAX_STICKERS}
          >
            {isUploadingSticker ? 'Adding…' : `+ Sticker (${draftStickers.length}/${MAX_STICKERS})`}
          </button>
          <button type="button" className="binder-cover-edit-btn" onClick={handleCancelCoverEdit}>
            Cancel
          </button>
          <button type="button" className="binder-cover-edit-btn binder-cover-edit-btn-primary" onClick={handleSaveCoverEdit}>
            Save Cover
          </button>
        </div>
      )}

      {stickerUploadError && isEditingCover && (
        <p className="binder-cover-edit-error">{stickerUploadError}</p>
      )}

      <input
        ref={stickerFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleStickerFileSelected}
      />
    </div>
  );
}

export function BinderCoverBack({ color }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: color,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* === FIX: same spine-line/sparkle motif as the front face and
          the Home-grid mini preview, so the inside of the cover (shown
          at spread 1, before the frame-halves take over from spread 2
          onward) doesn't read as a plain, un-styled panel. ===*/}
      <span className="binder-cover-spine-line binder-cover-spine-line-1" aria-hidden="true" />
      <span className="binder-cover-spine-line binder-cover-spine-line-2" aria-hidden="true" />
      <i className="ti ti-sparkles binder-cover-sparkle binder-cover-sparkle-1" aria-hidden="true" />
      <i className="ti ti-sparkles binder-cover-sparkle binder-cover-sparkle-2" aria-hidden="true" />
    </div>
  );
}