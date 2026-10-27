/**
 * v2.12 — published stories can carry up to 50 images. Story Detail renders
 * the first few tiles and reveals the rest in steps, so a long Media Library
 * never decodes dozens of large images at once (keeps the screen smooth).
 * The lightbox still pages through the whole gallery.
 */
export const GALLERY_FIRST = 8;
export const GALLERY_STEP = 12;

export function nextGalleryCount(current: number, total: number): number {
  return Math.min(total, Math.max(current, GALLERY_FIRST) + GALLERY_STEP);
}
