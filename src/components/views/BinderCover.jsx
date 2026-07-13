/**
 * @fileoverview BinderCover — sticker overlay for the binder's front
 * cover (placement/drag only — the Customize trigger and edit controls
 * now live in BinderCustomizePanel, floating in the left empty space
 * next to the closed cover).
 *
 * === Usage ===
 * const coverEditor = useBinderCoverEditor({ binder, toast });
 * <BinderBookFlip coverFrontContent={<BinderCoverStickers binder={binder} isEditingCover={coverEditor.isEditingCover} ... />} ... />
 */

import { CustomizerSticker } from '../modals/CustomizerSticker.jsx';

export function BinderCoverStickers({
  binder,
  // from useBinderCoverEditor
  coverRef,
  isEditingCover,
  draftStickers,
  selectedStickerId,
  setSelectedStickerId,
  handleChangeDraftSticker,
  handleRemoveDraftSticker,
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
    </div>
  );
}