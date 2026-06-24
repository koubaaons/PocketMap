/**
 * @fileoverview Client-side image compression before persisting as base64.
 * === ISSUE #88: compress all uploaded images (cards, stickers, covers, avatars) ===
 *
 * Pure browser APIs — no library needed. Resizes to maxWidth (preserving
 * aspect ratio).
 *
 * Two variants:
 *   compressImage — re-encodes as JPEG. Smaller file size, but JPEG has
 *     no alpha channel, so any transparency in the source is flattened
 *     to a solid color. Used for card images, covers, avatars — content
 *     that's always a full opaque rectangle anyway.
 *   compressStickerImage — re-encodes as PNG, preserving transparency.
 *     === ISSUE #92 STAGE 3: stickers need transparent backgrounds to
 *     look right sitting on top of a binder cover; JPEG would flatten
 *     that to a solid box. PNGs are larger than JPEGs at the same
 *     dimensions, but stickers are small (resized to maxWidth) and few
 *     (capped at 10 per cover), so the size tradeoff is worth it. ===
 */

const DEFAULT_MAX_WIDTH = 600;
const DEFAULT_QUALITY = 0.8;

/**
 * Compresses an uploaded image file and resolves to a base64 data URL.
 * Scales down to maxWidth if larger; never scales up. Re-encodes as JPEG.
 *
 * @param {File} file - The uploaded image file
 * @param {number} [maxWidth] - Max width in px (default 600)
 * @param {number} [quality] - JPEG quality 0–1 (default 0.8)
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

      resolve(canvas.toDataURL('image/jpeg', quality));
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
 * @param {number} [maxWidth] - Max width in px (default 600)
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