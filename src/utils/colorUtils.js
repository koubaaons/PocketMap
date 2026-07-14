/**
 * @fileoverview Small color utilities — currently just contrast-text
 * computation, used by the now-fully-customizable page_color (was a
 * fixed dark/light preset, see binder.types.js and BinderBookFlip.jsx).
 */

/**
 * Given a hex color, returns a readable text color (near-white or
 * near-black) for content displayed on top of it — standard relative
 * luminance formula, not a full WCAG contrast calculation, but more
 * than sufficient for choosing between two fixed text-color options.
 * @param {string} hex - e.g. "#1e1e1e"
 * @returns {string} either a light or dark text color
 */
export function getContrastTextColor(hex) {
  if (!hex || !hex.startsWith('#')) return 'rgba(255,255,255,0.2)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 128 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
}

/**
 * Normalizes a page_color value that might still be one of the old
 * fixed preset strings ('dark'/'light') from before this was
 * customizable, into an actual hex color. New binders already store
 * a real hex value and pass through unchanged.
 */
export function resolvePageColor(pageColor) {
  if (pageColor === 'dark') return '#1e1e1e';
  if (pageColor === 'light') return '#f5f5f5';
  return pageColor ?? '#1e1e1e';
}