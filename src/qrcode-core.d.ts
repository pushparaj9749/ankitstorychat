declare module 'qrcode/lib/core/qrcode' {
  export interface QrSegment {
    data: string | Uint8Array;
    mode: 'byte' | 'alphanumeric' | 'numeric' | 'kanji';
  }
  export interface QrCode {
    modules: { size: number; data: Uint8Array };
    version: number;
  }
  export function create(
    data: string | QrSegment[],
    options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; version?: number },
  ): QrCode;
}
