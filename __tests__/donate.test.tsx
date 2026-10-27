/**
 * v2.12.0 — voluntary UPI donations.
 *
 * Guards: correct UPI deep link, a real (decodable-size) QR, "Coming Soon"
 * while no UPI ID is set, the donate UI once one is, no network calls, and
 * nothing in the app gated behind donating.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const openURL = jest.fn((_u: string) => Promise.resolve());
const share = jest.fn((_o: unknown) => Promise.resolve());

jest.mock('react-native', () => {
  const R = require('react');
  const el = (tag: string) => (props: any) => R.createElement(tag, props, props.children);
  return {
    StyleSheet: { create: (s: any) => s, flatten: (s: any) => s },
    View: el('View'),
    Text: el('Text'),
    Pressable: el('Pressable'),
    ActivityIndicator: el('ActivityIndicator'),
    Linking: { openURL: (u: string) => openURL(u) },
    Share: { share: (o: unknown) => share(o) },
    Animated: {
      Value: class {
        constructor(public v: number) {}
        setValue(v: number) { this.v = v; }
      },
      View: el('AnimatedView'),
      spring: () => ({ start: () => {} }),
      parallel: () => ({ start: () => {} }),
    },
  };
});

jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  return { LinearGradient: (p: any) => R.createElement('LinearGradient', p, p.children) };
});

jest.mock('../src/lib/haptics', () => ({ lightBuzz: () => {} }));

jest.mock('../src/state/AppContext', () => {
  const { COLORS: C } = require('../src/theme');
  const value = { theme: C.midnight, uiTemplate: 'noir' };
  return { useApp: () => value };
});

import {
  DONATE_PAYEE_NAME,
  DONATE_UPI_ID,
  donationsEnabled,
  isValidUpiId,
  upiPayUrl,
  utf8Bytes,
} from '../src/lib/donate';
import { qrMatrix, qrPath } from '../src/lib/qr';
import { DonateCard } from '../src/components/DonateCard';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function textOf(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => (n.children as unknown[]).flat().filter((c) => typeof c === 'string').join(''))
    .join(' | ');
}

describe('UPI link', () => {
  it('builds a standard upi://pay link with payee, note and INR, no amount', () => {
    const url = upiPayUrl('ankit.kissa@okaxis');
    expect(url).toBe('upi://pay?pa=ankit.kissa@okaxis&pn=Kissa%20(Ankit)&tn=Kissa%20ke%20liye%20support&cu=INR');
    expect(url).not.toMatch(/[?&]am=/);
    expect(DONATE_PAYEE_NAME).toBe('Kissa (Ankit)');
  });

  it('validates UPI IDs and refuses to build a link for bad ones', () => {
    for (const ok of ['ankit@ybl', 'a.b-c_d@okhdfcbank', '9876543210@paytm', 'name@upi']) {
      expect(isValidUpiId(ok)).toBe(true);
    }
    for (const bad of ['', ' ', 'ankit', '@ybl', 'ankit@', 'a@1bank', 'an kit@ybl', 'x@ybl&am=999']) {
      expect(isValidUpiId(bad)).toBe(false);
      expect(upiPayUrl(bad)).toBeNull();
    }
  });

  it('UPI ID config is either empty (Coming Soon) or a valid ID', () => {
    expect(DONATE_UPI_ID === '' || isValidUpiId(DONATE_UPI_ID)).toBe(true);
    expect(donationsEnabled()).toBe(DONATE_UPI_ID !== '');
  });

  it('utf8Bytes matches Buffer for ASCII and Unicode', () => {
    for (const s of ['upi://pay?pa=a@ybl', 'Kissa ❤ किस्सा 😀']) {
      expect(Array.from(utf8Bytes(s))).toEqual(Array.from(Buffer.from(s, 'utf8')));
    }
  });
});

describe('QR', () => {
  it('encodes the UPI link into a real QR matrix with finder patterns', () => {
    const m = qrMatrix(upiPayUrl('ankit.kissa@okaxis')!);
    expect(m.size).toBeGreaterThanOrEqual(25);
    expect((m.size - 17) % 4).toBe(0);
    // Top-left finder: dark 7x7 border, light ring, dark 3x3 centre.
    expect(m.dark(0, 0) && m.dark(6, 0) && m.dark(0, 6) && m.dark(6, 6)).toBe(true);
    expect(m.dark(1, 1)).toBe(false);
    expect(m.dark(3, 3)).toBe(true);
    const d = qrPath(m);
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});

describe('DonateCard', () => {
  beforeEach(() => {
    openURL.mockClear();
    share.mockClear();
  });

  it('shows "Coming Soon" and no donate UI while no UPI ID is set', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<DonateCard upiId="" repoUrl="https://github.com/x/y" />);
    });
    const t = textOf(tree);
    expect(t).toContain('Help the Developer');
    expect(t).toContain('Coming Soon');
    expect(t).not.toContain('Donate via UPI');
    expect(tree.root.findAll((n) => (n.type as unknown) === 'Svg' && n.props.accessibilityLabel === 'UPI QR code')).toHaveLength(0);
  });

  it('with a UPI ID: donate button opens the UPI app, QR + ID shown, optional wording', async () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<DonateCard upiId="ankit.kissa@okaxis" repoUrl="https://github.com/x/y" />);
    });
    const t = textOf(tree);
    expect(t).not.toContain('Coming Soon');
    expect(t).toContain('Donate via UPI');
    expect(t).toContain('100% Optional');
    expect(t).toContain('ankit.kissa@okaxis');
    expect(t).toContain('Star on GitHub');
    expect(tree.root.findAll((n) => (n.type as unknown) === 'Svg' && n.props.accessibilityLabel === 'UPI QR code')).toHaveLength(1);
    const qrPathEl = tree.root.find((n) => (n.type as unknown) === 'Path' && String(n.props.d).startsWith('M4 4'));
    expect(qrPathEl).toBeTruthy();

    const btn = tree.root.find((n) => n.props.accessibilityLabel === 'Donate to Kissa (Ankit) via UPI' && !!n.props.onPress);
    await act(async () => {
      btn.props.onPress();
    });
    expect(openURL).toHaveBeenCalledWith(upiPayUrl('ankit.kissa@okaxis'));
  });

  it('falls back to sharing the UPI ID when no UPI app can open the link', async () => {
    openURL.mockImplementationOnce(() => Promise.reject(new Error('no activity')));
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<DonateCard upiId="ankit.kissa@okaxis" repoUrl="https://github.com/x/y" />);
    });
    const btn = tree.root.find((n) => n.props.accessibilityLabel === 'Donate to Kissa (Ankit) via UPI' && !!n.props.onPress);
    await act(async () => {
      btn.props.onPress();
    });
    expect(share).toHaveBeenCalledWith({ message: 'Kissa (Ankit) UPI ID: ankit.kissa@okaxis' });
  });
});

describe('donations stay voluntary and serverless', () => {
  it('donation code makes no network calls and stores nothing', () => {
    for (const f of ['src/lib/donate.ts', 'src/lib/qr.ts', 'src/components/DonateCard.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|axios|AsyncStorage|SecureStore|from '\.\.\/lib\/db'/);
    }
  });

  it('only the About card uses the donation module — no feature is gated on it', () => {
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && /lib\/donate'|DonateCard'/.test(read(rel))) users.push(rel.split(path.sep).join('/'));
      }
    };
    walk('src');
    expect(users.sort()).toEqual(['src/components/DonateCard.tsx', 'src/screens/About.tsx']);
  });

  it('About renders the DonateCard and Privacy explains donations', () => {
    expect(read('src/screens/About.tsx')).toMatch(/<DonateCard repoUrl=\{REPO\} \/>/);
    expect(read('src/legal/privacy.ts')).toMatch(/Voluntary donations \(UPI\)/);
  });
});
