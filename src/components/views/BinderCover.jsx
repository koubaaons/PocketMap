/**
 * @fileoverview BinderCover — sticker customization overlay for the
 * binder's front cover.
 *
 * Deliberately minimal: no background, no shape, no decorations at
 * all — BinderBookFlip's own cover pair (.book-page-pair-cover-front)
 * already provides the actual cover box, color, and rounded shape.
 * This component only renders on TOP of that: the placed stickers,
 * the "Customize" trigger, and the sticker-editing controls while
 * active. It's rendered as coverFrontContent, absolutely filling
 * whatever box BinderBookFlip gives it.
 *
 * === Usage ===
 * const coverEditor = useBinderCoverEditor({ binder, toast });
 * <BinderBookFlip coverFrontContent={<BinderCoverStickers binder={binder} isCover={isCover} {...coverEditor} />} ... />
 */

import { CustomizerSticker } from '../modals/CustomizerSticker.jsx';

export function BinderCoverStickers({
  binder,
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
      style={{ position: 'absolute', inset: 0 }}
      onClick={isEditingCover ? (e) => e.stopPropagation() : undefined}
      onMouseDown={isEditingCover ? () => setSelectedStickerId(null) : undefined}
    >
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