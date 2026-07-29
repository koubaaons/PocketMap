/**
 * @fileoverview Client-side image compression before persisting as base64.
 * === ISSUE #88: compress all uploaded images (cards, stickers, covers, avatars) ===
 *
 * Pure browser APIs — no library needed. Resizes to maxWidth (preserving
 * aspect ratio).
 *
 * Two variants:
 *   compressImage — re-encodes as WebP. At equivalent visual quality,
 *     WebP is meaningfully smaller than JPEG (typically 25-35%) — a
 *     real, well-documented compression-format advantage, not a
 *     quality tradeoff. Requested directly, to help users get more
 *     out of their storage quota. Browsers that don't support WebP
 *     encoding (older Firefox, confirmed via its own source code —
 *     it silently falls back rather than erroring) just get a JPEG
 *     instead, per the canvas API's own documented fallback
 *     behavior — never a broken upload, just no size benefit on
 *     those browsers specifically. No alpha channel either way, so
 *     transparency in the source is flattened to a solid color —
 *     used for card images, covers, avatars, content that's always a
 *     full opaque rectangle anyway.
 *   compressStickerImage — re-encodes as PNG, preserving transparency.
 *     === ISSUE #92 STAGE 3: stickers need transparent backgrounds to
 *     look right sitting on top of a binder cover; JPEG would flatten
 *     that to a solid box. PNGs are larger than JPEGs at the same
 *     dimensions, but stickers are small (resized to maxWidth) and few
 *     (capped at 10 per cover), so the size tradeoff is worth it.
 *     Deliberately NOT switched to WebP alongside compressImage above —
 *     an open Chromium issue specifically about WebP-with-transparency
 *     in canvas exports couldn't be fully verified (its details
 *     require sign-in to view), and a genuinely broken transparency
 *     result (not just unsupported, but visibly wrong) is a real risk
 *     worth avoiding here specifically, unlike the opaque case above
 *     where the worst case is just "no savings on this browser". ===
 */

const DEFAULT_MAX_WIDTH = 500;
const DEFAULT_QUALITY = 0.8;

/**
 * Compresses an uploaded image file and resolves to a base64 data URL.
 * Scales down to maxWidth if larger; never scales up. Re-encodes as
 * WebP (falls back to JPEG automatically on browsers that don't
 * support WebP encoding — canvas.toDataURL's own documented behavior,
 * not something this function needs to detect or handle itself).
 *
 * @param {File} file - The uploaded image file
 * @param {number} [maxWidth] - Max width in px (default 500)
 * @param {number} [quality] - Image quality 0–1 (default 0.8)
 * @returns {Promise<string>} base64 data URL
 */
export function compressImage(file, maxWidth = DEFAULT_MAX_WIDTH, quality = DEFAULT_QUALITY) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('compressImage: no file provided'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL('image/webp', quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('compressImage: failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses an uploaded sticker image, preserving transparency.
 * Unlike compressImage (JPEG, no alpha channel — transparent pixels get
 * flattened to a solid color), this resolves to a PNG data URL, keeping
 * any transparent background intact.
 *
 * @param {File} file - The uploaded image file
 * @param {number} [maxWidth] - Max width in px (default 500)
 * @returns {Promise<string>} base64 PNG data URL
 */
export function compressStickerImage(file, maxWidth = DEFAULT_MAX_WIDTH) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('compressStickerImage: no file provided'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      // No fillRect before drawing — leaving the canvas un-filled is
      // what preserves transparency; filling with any color first would
      // flatten alpha the same way JPEG encoding does.
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('compressStickerImage: failed to load image'));
    };

    img.src = objectUrl;
  });
}