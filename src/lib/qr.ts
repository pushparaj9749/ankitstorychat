/**
 * QR matrix for the donation card. Uses only qrcode's pure-JS core encoder
 * (no canvas / fs / Buffer) and feeds it pre-encoded bytes so it never needs
 * TextEncoder.
 */
import { create } from 'qrcode/lib/core/qrcode';
import { utf8Bytes } from './donate';

export interface QrMatrix {
  size: number;
  /** Row-major, 1 = dark module. */
  dark: (x: number, y: number) => boolean;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = create([{ data: utf8Bytes(text), mode: 'byte' }], { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  return { size, dark: (x, y) => data[y * size + x] === 1 };
}

/** One SVG path ("M x y h1 v1 h-1 z" per dark module), offset by a quiet zone. */
export function qrPath(m: QrMatrix, quiet = 4): string {
  let d = '';
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (m.dark(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return d;
}
