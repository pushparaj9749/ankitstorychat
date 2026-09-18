/**
 * NaturalImage — renders an image at ITS OWN intrinsic aspect ratio.
 *
 * Kissa artwork ships in many ratios (16:9, 3:2, 4:3, 3:4, 2:3, 9:16, 1:1 …),
 * so no fixed ratio may be forced anywhere. The display rule enforced here is:
 *
 *     IMAGE RATIO = SOURCE IMAGE RATIO
 *
 * How the ratio is derived (never hardcoded):
 *   - bundled `require()` assets → `Image.resolveAssetSource` (synchronous)
 *   - URI sources (http/https/file/data)  → `Image.getSize` (async), with an
 *     `onLoad` fallback that reads `nativeEvent.source` dimensions
 *
 * The image box is `width × (width / sourceRatio)` and the image itself is
 * `contain`-fitted, so it is never cropped, never stretched, never distorted.
 * An optional `maxHeight` bounds tall images in bounded layouts (lightbox,
 * hero) — when it kicks in the artwork letterboxes (contain), it is NEVER
 * cropped into a different shape.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageErrorEvent,
  type ImageLoadEvent,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Default height of the loading/failure placeholder when no ratio is known yet. */
export const NATURAL_IMAGE_PLACEHOLDER_MIN_HEIGHT = 120;

export interface NaturalImageProps {
  /** Image source (`require()` number, or `{ uri }`). `null` renders the fallback. */
  source: ImageSourcePropType | null;
  /** Width constraints etc. flow through here (e.g. `{ width: 64 }`). Never a ratio. */
  style?: StyleProp<ImageStyle>;
  /**
   * Optional upper bound for bounded layouts (hero, lightbox). Uses contain
   * sizing — the artwork keeps its own ratio and letterboxes, never crops.
   */
  maxHeight?: number | `${number}%`;
  /** Node rendered when the image fails to load (or the source is null). */
  fallback?: React.ReactNode;
  /** Optional spinner/placeholder shown while loading. Defaults to a skeleton tint. */
  placeholder?: React.ReactNode;
  /** Placeholder box height while the source ratio is unknown. Loading chrome only. */
  placeholderMinHeight?: number;
  /** Tint behind the artwork while it loads / when it fails. */
  tint?: string;
  accessibilityLabel?: string;
  testID?: string;
  onLoad?: (event: ImageLoadEvent) => void;
  onError?: (event: ImageErrorEvent) => void;
}

/** Stable identity for a source: asset number or uri (object identity is not stable). */
function sourceKeyOf(source: ImageSourcePropType | null): number | string | null {
  if (source == null) return null;
  if (typeof source === 'number') return source;
  if (Array.isArray(source)) return sourceKeyOf(source[0] ?? null);
  const uri = source.uri;
  return typeof uri === 'string' && uri.length > 0 ? uri : null;
}

/**
 * Synchronous intrinsic size for bundled `require()` assets.
 * Returns null for uri sources (those resolve asynchronously) and in test
 * environments where Image is stubbed without the static helpers.
 */
function bundledSizeOf(source: ImageSourcePropType | null): { width: number; height: number } | null {
  if (source == null || typeof source !== 'number') return null;
  const resolve = Image.resolveAssetSource;
  if (typeof resolve !== 'function') return null;
  try {
    const resolved = resolve(source);
    if (resolved && resolved.width > 0 && resolved.height > 0) {
      return { width: resolved.width, height: resolved.height };
    }
  } catch {
    // Stay null — the onLoad fallback below still recovers the dimensions.
  }
  return null;
}

/**
 * Renders any image at its own original aspect ratio. See the file header:
 * every story cover, gallery tile, media preview and lightbox view must go
 * through this rule so nothing upstream can force a shape onto artwork.
 */
export function NaturalImage({
  source,
  style,
  maxHeight,
  fallback,
  placeholder,
  placeholderMinHeight = NATURAL_IMAGE_PLACEHOLDER_MIN_HEIGHT,
  tint,
  accessibilityLabel,
  testID,
  onLoad,
  onError,
}: NaturalImageProps) {
  /** Aspect ratio derived from the actual image metadata (width / height). */
  const [ratio, setRatio] = useState<number | null>(() => {
    const size = bundledSizeOf(source);
    return size ? size.width / size.height : null;
  });
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Keep the latest source object available to effects without depending on
  // its (unstable) identity — the effect below is keyed by number/uri instead.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const key = sourceKeyOf(source);

  useEffect(() => {
    let alive = true;
    const current = sourceRef.current;

    // Bundled assets resolve synchronously — no placeholder flash.
    const bundled = bundledSizeOf(current);
    if (bundled) {
      setRatio(bundled.width / bundled.height);
      setFailed(false);
      setLoaded(false);
      return;
    }

    setRatio(null);
    setFailed(false);
    setLoaded(false);

    if (key == null) return; // nothing to measure (null source → fallback)
    if (typeof Image.getSize !== 'function') return; // stubbed test Image

    Image.getSize(
      String(key),
      (width, height) => {
        if (alive && width > 0 && height > 0) setRatio(width / height);
      },
      () => undefined, // onLoad below still recovers dimensions for this source
    );
    return () => {
      alive = false;
    };
  }, [key]);

  const handleLoad = (event: ImageLoadEvent) => {
    // Universal fallback: the load event carries the true decoded dimensions.
    const dims = event.nativeEvent?.source;
    if (dims && dims.width > 0 && dims.height > 0) {
      setRatio((prev) => (prev == null ? dims.width / dims.height : prev));
    }
    setLoaded(true);
    onLoad?.(event);
  };

  const handleError = (event: ImageErrorEvent) => {
    setFailed(true);
    onError?.(event);
  };

  const pending = ratio == null;
  const showImage = source != null && sourceKeyOf(source) != null && !failed;

  const boxStyle: StyleProp<ImageStyle> = [
    styles.box,
    tint != null ? { backgroundColor: tint } : null,
    // While the true ratio is still being measured, the placeholder keeps the
    // layout from collapsing. This NEVER applies to rendered artwork — as soon
    // as the ratio is known the box is exactly `width × width / sourceRatio`.
    pending ? { minHeight: placeholderMinHeight } : null,
    ratio != null && ratio > 0 ? { aspectRatio: ratio } : null,
    maxHeight != null ? { maxHeight } : null,
    style,
  ];

  return (
    <View style={boxStyle} accessibilityLabel={accessibilityLabel} testID={testID}>
      {showImage ? (
        <Image
          source={source}
          style={[styles.img, loaded ? styles.imgVisible : styles.imgHidden]}
          resizeMode="contain"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}
      {showImage && !loaded ? (
        placeholder ?? <View style={styles.skeleton} pointerEvents="none" />
      ) : null}
      {!showImage ? (
        fallback ?? (
          <View style={styles.defaultFallback} accessibilityLabel="Image unavailable">
            <Ionicons name="image-outline" size={28} color="#6F6B78" />
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    // Full-width by default; callers narrow it via `style` (e.g. { width: 64 }).
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The box already matches the image's own ratio, so contain is an exact,
  // distortion-free fit (and letterboxes instead of cropping when a bound
  // such as maxHeight applies).
  img: { width: '100%', height: '100%' },
  imgVisible: { opacity: 1 },
  imgHidden: { opacity: 0 },
  skeleton: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  defaultFallback: { padding: 12 },
});
