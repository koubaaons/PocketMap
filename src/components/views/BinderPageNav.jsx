/**
 * @fileoverview BinderPageNav — purely presentational, same reasoning
 * as BinderTopbar (see that file's header comment). Editable page
 * number input, replaces the old thumbnails bar.
 */

export function BinderPageNav({
  isClosed,
  pageInputValue,
  totalPages,
  currentDisplayPage,
  onFocusInput,
  onChangeInput,
  onCommitInput,
  onResetInput,
}) {
  return (
    <div className={`binder-page-nav ${isClosed ? 'binder-topbar-disabled' : ''}`}>
      <input
        type="number"
        className="binder-page-input"
        value={pageInputValue}
        min={1}
        max={totalPages}
        disabled={isClosed}
        onFocus={onFocusInput}
        onChange={(e) => onChangeInput(e.target.value)}
        onBlur={onCommitInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            onResetInput(String(currentDisplayPage));
            e.currentTarget.blur();
          }
        }}
        aria-label="Jump to page"
      />
      <span className="binder-page-indicator-suffix">/ {totalPages} pages</span>
    </div>
  );
}