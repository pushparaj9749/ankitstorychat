/**
 * Image picking + preparation for story media uploads (cover / gallery).
 *
 * Uses expo-document-picker (already a dependency) with an image type filter,
 * and expo-file-system to read the chosen file as base64. All hard limits are
 * enforced AGAIN server-side (signature, size, dimensions) — the client checks
 * here are only to give the user immediate, honest feedback.
 */
import * as DocumentPicker from 'expo-document-picker';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';

/** Mirror of the Worker limits (see worker/src/media.ts). */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
export const MAX_GALLERY_IMAGES = 8; // per story, cover included
export const MAX_TOTAL_GALLERY_BYTES = 12 * 1024 * 1024; // 12 MB total for the 8 gallery slots

/** A picked image ready for upload (local URI for previews, base64 for POST). */
export interface PickedImage {
  /** Local file URI — safe for RN <Image source={{ uri }}>. */
  uri: string;
  /** base64 (no data-URI prefix) of the file bytes. */
  base64: string;
  /** File size in bytes. */
  size: number;
  /** Original file name (display only — never trusted server-side). */
  name: string;
}

export class ImagePickError extends Error {
  readonly code: 'cancelled' | 'size' | 'read' | 'pick';
  constructor(message: string, code: ImagePickError['code']) {
    super(message);
    this.name = 'ImagePickError';
    this.code = code;
  }
}

/**
 * Pick a single image from the device. Throws ImagePickError with a
 * user-presentable message; `cancelled` when the user backs out.
 */
export async function pickImage(): Promise<PickedImage> {
  let res: DocumentPicker.DocumentPickerResult;
  try {
    res = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
  } catch {
    throw new ImagePickError('Could not open the photo picker.', 'pick');
  }
  if (res.canceled) throw new ImagePickError('Pick cancelled.', 'cancelled');
  const asset = res.assets?.[0];
  if (!asset || !asset.uri) throw new ImagePickError('No image selected.', 'pick');

  let size: number | null = null;
  try {
    const info = await getInfoAsync(asset.uri);
    if (info.exists && !info.isDirectory) size = info.size ?? null;
  } catch {
    // Fall through — readAsStringAsync will still give us the bytes.
  }
  if (size !== null && size > MAX_IMAGE_BYTES) {
    throw new ImagePickError(
      `Image is too large (${(size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
      'size',
    );
  }

  let base64: string;
  try {
    base64 = await readAsStringAsync(asset.uri, { encoding: 'base64' });
  } catch {
    throw new ImagePickError('Could not read the selected image.', 'read');
  }
  if (!base64) throw new ImagePickError('The selected image is empty.', 'read');

  return {
    uri: asset.uri,
    base64,
    size: size ?? Math.floor((base64.length * 3) / 4),
    name: asset.name ?? 'image',
  };
}

/** True when the current set of gallery images can accept one more. */
export function canAddGalleryImage(currentCount: number, currentBytes: number): {
  ok: boolean;
  reason?: string;
} {
  if (currentCount + 1 > MAX_GALLERY_IMAGES) {
    return { ok: false, reason: `Max ${MAX_GALLERY_IMAGES} images per story.` };
  }
  if (currentBytes + MAX_IMAGE_BYTES > MAX_TOTAL_GALLERY_BYTES) {
    return { ok: false, reason: 'Total gallery size limit reached (12 MB).' };
  }
  return { ok: true };
}
