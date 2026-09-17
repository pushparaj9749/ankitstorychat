/**
 * ACCEPTANCE TESTS — "IMAGE RATIO = SOURCE IMAGE RATIO".
 *
 * Part 1 (behaviour): NaturalImage / CoverImage must render every image at
 *   its own intrinsic aspect ratio — 16:9 stays 16:9, 4:3 stays 4:3, 3:4 stays
 *   3:4, 1:1 stays 1:1, and every other ratio stays itself. No stretching, no
 *   cropping, no forced shape, no fixed image height.
 *
 * Part 2 (policy): the app source must not re-introduce fixed artwork ratios
 *   (aspectRatio constants outside NaturalImage, cover-cropping resizeMode,
 *   the old COVER_ASPECT constant).
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fixture images with the dimension mixes that actually ship in the app. */
const FIXTURES: Record<string, { width: number; height: number }> = {
  'https://img.test/landscape-16-9.jpg': { width: 1920, height: 1080 },
  'https://img.test/classic-4-3.jpg': { width: 1200, height: 900 },
  'https://img.test/portrait-3-4.jpg': { width: 1080, height: 1440 },
  'https://img.test/square-1-1.jpg': { width: 1000, height: 1000 },
  // Real bundled Kissa cover dimensions (aakhri-yodha.jpg etc.).
  'https://img.test/tall-900-1613.jpg': { width: 900, height: 1613 },
  'https://img.test/bundled-2-3.jpg': { width: 1024, height: 1536 },
};

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  const Image = (props: any) => R.createElement('Image', props, props.children);
  Image.getSize = (
    uri: string,
    success: (width: number, height: number) => void,
    failure?: (error: unknown) => void,
  ) => {
    const size = FIXTURES[uri];
    if (size) success(size.width, size.height);
    else failure?.(new Error('no such fixture'));
  };
  Image.resolveAssetSource = (n: number) => ({
    width: 1024,
    height: 1536,
    uri: `asset://${n}`,
    scale: 1,
  });
  return {
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
    View: el('View'),
    Text: el('Text'),
    Image,
  };
});

import { NaturalImage } from '../src/components/NaturalImage';
import { CoverImage } from '../src/components/CoverImage';

type Node = { type: unknown; props: Record<string, any> };

function flatten(style: unknown): Record<string, any> {
  const array = Array.isArray(style) ? style : style ? [style] : [];
  return Object.assign({}, ...array.map((s) => (s && typeof s === 'object' ? s : {})));
}

function hostNodes(root: renderer.ReactTestInstance, tag: string): Node[] {
  return root
    .findAll((n: renderer.ReactTestInstance) => typeof n.type === 'string' && n.type === tag)
    .map((n) => n as unknown as Node);
}

/** The outermost View NaturalImage renders — the image's sizing box. */
function findBox(root: renderer.ReactTestInstance): Node {
  const box = hostNodes(root, 'View').find(
    (v) => 'aspectRatio' in flatten(v.props.style) || 'minHeight' in flatten(v.props.style),
  );
  if (!box) throw new Error('NaturalImage box view not found');
  return box;
}

function findImg(root: renderer.ReactTestInstance): Node {
  const imgs = hostNodes(root, 'Image');
  if (imgs.length === 0) throw new Error('Image element not found');
  return imgs[0];
}

async function render(element: React.ReactElement): Promise<renderer.ReactTestRenderer> {
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = renderer.create(element);
  });
  return tree as renderer.ReactTestRenderer;
}

describe('NaturalImage: every image keeps its OWN aspect ratio', () => {
  test.each([
    ['https://img.test/landscape-16-9.jpg', 1920 / 1080],
    ['https://img.test/classic-4-3.jpg', 1200 / 900],
    ['https://img.test/portrait-3-4.jpg', 1080 / 1440],
    ['https://img.test/square-1-1.jpg', 1000 / 1000],
    ['https://img.test/tall-900-1613.jpg', 900 / 1613],
    ['https://img.test/bundled-2-3.jpg', 1024 / 1536],
  ])('%s → aspectRatio %d', async (uri, expected) => {
    const tree = await render(<NaturalImage source={{ uri }} />);
    const style = flatten(findBox(tree.root).props.style);
    expect(style.aspectRatio).toBeCloseTo(expected, 10);
  });

  test('bundled require() assets resolve synchronously (1024×1536 → 2:3)', async () => {
    const tree = await render(<NaturalImage source={7} />);
    const style = flatten(findBox(tree.root).props.style);
    expect(style.aspectRatio).toBeCloseTo(1024 / 1536, 10);
  });

  test('the sizing box never sets a fixed height — only the derived ratio', async () => {
    const tree = await render(<NaturalImage source={{ uri: 'https://img.test/portrait-3-4.jpg' }} />);
    const style = flatten(findBox(tree.root).props.style);
    expect(style.height).toBeUndefined();
    expect(style.aspectRatio).toBeCloseTo(1080 / 1440, 10);
    expect(style.width).toBe('100%');
  });

  test('width constraints flow through the style prop untouched', async () => {
    const tree = await render(
      <NaturalImage source={{ uri: 'https://img.test/landscape-16-9.jpg' }} style={{ width: 64 }} />,
    );
    const style = flatten(findBox(tree.root).props.style);
    expect(style.width).toBe(64);
    expect(style.height).toBeUndefined();
    expect(style.aspectRatio).toBeCloseTo(1920 / 1080, 10);
  });

  test('bounded layouts pass maxHeight through (contain — never a crop)', async () => {
    const tree = await render(
      <NaturalImage
        source={{ uri: 'https://img.test/portrait-3-4.jpg' }}
        style={{ width: '100%', maxHeight: '78%' }}
      />,
    );
    const style = flatten(findBox(tree.root).props.style);
    expect(style.maxHeight).toBe('78%');
    expect(style.aspectRatio).toBeCloseTo(1080 / 1440, 10);
  });

  test('the image itself is contain-fitted (no cover crop, no stretch)', async () => {
    const tree = await render(<NaturalImage source={{ uri: 'https://img.test/square-1-1.jpg' }} />);
    expect(findImg(tree.root).props.resizeMode).toBe('contain');
  });

  test('recovers the true ratio from the load event when getSize fails', async () => {
    const tree = await render(<NaturalImage source={{ uri: 'https://img.test/not-in-fixtures.jpg' }} />);
    // getSize failed → still pending, no ratio yet.
    expect(flatten(findBox(tree.root).props.style).aspectRatio).toBeUndefined();

    const img = findImg(tree.root);
    await act(async () => {
      img.props.onLoad({
        nativeEvent: { source: { width: 640, height: 480, uri: 'https://img.test/not-in-fixtures.jpg' } },
      });
    });
    expect(flatten(findBox(tree.root).props.style).aspectRatio).toBeCloseTo(640 / 480, 10);
  });

  test('a null source renders the caller fallback instead of an image', async () => {
    const tree = await render(
      <NaturalImage source={null} fallback={'A'} placeholderMinHeight={90} />,
    );
    const style = flatten(findBox(tree.root).props.style);
    expect(style.aspectRatio).toBeUndefined();
    expect(style.minHeight).toBe(90);
    expect(JSON.stringify(tree.toJSON())).toContain('A');
    expect(() => findImg(tree.root)).toThrow();
  });
});

describe('CoverImage: story covers keep their own ratio', () => {
  test('16:9 cover stays 16:9 and carries the accent tint', async () => {
    const tree = await render(
      <CoverImage source={{ uri: 'https://img.test/landscape-16-9.jpg' }} accentColor="#F5C542" />,
    );
    const style = flatten(findBox(tree.root).props.style);
    expect(style.aspectRatio).toBeCloseTo(1920 / 1080, 10);
    expect(style.height).toBeUndefined();
    expect(style.backgroundColor).toBe('#F5C54233');
  });

  test('2:3 bundled cover stays 2:3 (no forced 3:4)', async () => {
    const tree = await render(<CoverImage source={3} fallbackLetter="Midnight Local" />);
    expect(flatten(findBox(tree.root).props.style).aspectRatio).toBeCloseTo(1024 / 1536, 10);
  });

  test('missing artwork falls back to the story letter, never a cropped box', async () => {
    const tree = await render(<CoverImage source={null} fallbackLetter="chai dreams" placeholderMinHeight={140} />);
    const style = flatten(findBox(tree.root).props.style);
    expect(style.aspectRatio).toBeUndefined();
    expect(style.minHeight).toBe(140);
    expect(JSON.stringify(tree.toJSON())).toContain('C');
  });
});

describe('acceptance: real bundled artwork keeps its exact ratio', () => {
  const fs = require('fs');
  const path = require('path');

  /** Minimal JPEG/PNG header parser — the image's true pixel dimensions. */
  function imageSize(file: string): { width: number; height: number } {
    const buf = fs.readFileSync(file);
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
    if (buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    throw new Error(`unsupported image: ${file}`);
  }

  /** Existing covers that between them cover 16:9, 3:2, 3:4, 2:3 and taller. */
  const realCovers = [
    'cafe-queen-myra.jpg', // 1672×941  (~16:9 landscape)
    'alishaa.jpg',         // 612×407   (3:2 landscape)
    'bhabi-ka-ladla-devar.jpg', // 1086×1448 (3:4 portrait)
    'chai-dreams.jpg',     // 1024×1536 (2:3 portrait)
    'aakhri-yodha.jpg',    // 900×1613  (taller than 2:3)
  ].map((name) => path.join(__dirname, '..', 'assets', 'covers', name));

  test.each(realCovers)('%s renders at its own ratio', async (file) => {
    const { width, height } = imageSize(file);
    expect(width).toBeGreaterThan(0);

    // The exact flow the app uses: dimensions resolve (resolveAssetSource /
    // getSize) → NaturalImage derives the box ratio from THOSE dimensions.
    FIXTURES[`file://${file}`] = { width, height };
    const tree = await render(<CoverImage source={{ uri: `file://${file}` }} fallbackLetter="x" />);
    const style = flatten(findBox(tree.root).props.style);

    // IMAGE RATIO = SOURCE IMAGE RATIO — exactly, no rounding to a preset.
    expect(style.aspectRatio).toBe(width / height);
    expect(style.height).toBeUndefined();
    delete FIXTURES[`file://${file}`];
  });
});

describe('policy: no fixed artwork ratios anywhere in the app source', () => {
  const fs = require('fs');
  const path = require('path');

  const SRC = path.join(__dirname, '..', 'src');
  const APP_ROOT = path.join(__dirname, '..');

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: { name: string; isDirectory: () => boolean }) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    });
  }

  const appTsxFiles = walk(SRC).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

  test('aspectRatio is only ever the DERIVED source ratio (NaturalImage)', () => {
    const offenders = appTsxFiles.filter(
      (f) => !f.endsWith(path.join('components', 'NaturalImage.tsx')) &&
        fs.readFileSync(f, 'utf8').includes('aspectRatio'),
    );
    expect(offenders).toEqual([]);
  });

  test('no story/media image is rendered with a cover-cropping resizeMode', () => {
    const offenders = appTsxFiles.filter((f) =>
      /resizeMode\s*[:=]\s*["']cover["']/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  test('the old fixed COVER_ASPECT constant is gone', () => {
    const offenders = appTsxFiles.filter((f) => fs.readFileSync(f, 'utf8').includes('COVER_ASPECT'));
    expect(offenders).toEqual([]);
  });

  test('the marketing site renders covers naturally (no object-fit crop)', () => {
    const css = fs.readFileSync(path.join(APP_ROOT, 'website', 'styles.css'), 'utf8');
    expect(css).not.toContain('object-fit: cover');
    const rule = css.match(/\.story-card img \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('height: auto');
  });
});
