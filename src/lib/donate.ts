/**
 * v2.12.0 — Voluntary donations (owner decision, Oct 2026).
 *
 * "Help the Developer" on the About screen opens the phone's own UPI app
 * (GPay / PhonePe / Paytm / BHIM …) with the owner's UPI ID pre-filled, and
 * shows the same payment as a QR code for scanning from another phone.
 *
 * Rules (match the app's architecture):
 *  - No Kissa server is involved: no fetch, no tracking, no payment records.
 *    The money goes straight from the user's UPI app to the owner.
 *  - Purely voluntary: nothing is unlocked, gated or nagged about.
 *  - While DONATE_UPI_ID is empty the card stays "Coming Soon".
 */

/** The owner's public UPI ID (e.g. "name@okaxis"). Empty = donations off. */
export const DONATE_UPI_ID = '';

/** Name shown as the payee inside the UPI app. */
export const DONATE_PAYEE_NAME = 'Kissa (Ankit)';

/** Default transaction note. */
export const DONATE_NOTE = 'Kissa ke liye support';

// VPA: handle@psp — letters, digits, dot, dash, underscore before "@",
// a provider handle (letters first) after it.
const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;

export function isValidUpiId(id: string | null | undefined): id is string {
  return typeof id === 'string' && UPI_ID_RE.test(id.trim());
}

export function donationsEnabled(id: string = DONATE_UPI_ID): boolean {
  return isValidUpiId(id);
}

/** encodeURIComponent, but keep "@" readable (some UPI apps dislike %40 in pa). */
function enc(s: string): string {
  return encodeURIComponent(s).replace(/%40/g, '@');
}

/**
 * Standard UPI deep link (NPCI "upi://pay"). No amount — the user chooses.
 * Returns null when the UPI ID is missing or invalid.
 */
export function upiPayUrl(
  id: string = DONATE_UPI_ID,
  payee: string = DONATE_PAYEE_NAME,
  note: string = DONATE_NOTE,
): string | null {
  if (!isValidUpiId(id)) return null;
  const parts = [`pa=${enc(id.trim())}`, `pn=${enc(payee)}`, `tn=${enc(note)}`, 'cu=INR'];
  return `upi://pay?${parts.join('&')}`;
}

/** UTF-8 bytes without relying on TextEncoder (Hermes-safe). */
export function utf8Bytes(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return Uint8Array.from(out);
}
