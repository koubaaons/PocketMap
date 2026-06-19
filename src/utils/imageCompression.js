/**
 * @fileoverview Client-side image compression before persisting as base64.
 * === ISSUE #88: compress all uploaded images (cards, stickers, covers, avatars) ===
 *
 * Pure browser APIs — no library needed. Resizes to maxWidth (preserving
 * aspect ratio) and re-encodes as JPEG at the given quality.
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