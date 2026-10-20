/**
 * docs/COVER_GUIDE.md — every NEW story cover is a 2:3 portrait.
 * Covers that existed before the rule (Oct 2026) are grandfathered below;
 * never add new ids to this list.
 */
import * as fs from 'fs';
import * as path from 'path';

const LEGACY_NON_PORTRAIT = new Set([
  'alishaa',
  'angel-next-door-secret-chairman',
  'barish-boi-aur-tum',
  'bhaiya-ki-saali',
  'cafe-queen-myra',
  'gyarah-mahine-ka-agreement',
  'khuni-ghadi-ka-raaz',
  'kuch-toh-bol-na',
  'meethi-dushmani',
  'mere-ghar-ki-sabse-badi-paheli',
  'meri-fake-girlfriend',
  'meri-rival',
  'mujhe-tumse-nafrat-hai',
  'nayi-padosan-purani-paheli',
  'pehli-barf',
  'superstar-ki-chhutti',
  'the-angel-next-door-spoils-me-rotten',
  'uski-muskaan-ke-peeche',
  'woh-jo-hamesha-mere-saath-thi',
  'woh-ladki-jo-mujhe-bhoolti-hi-nahi',
  'woh-shaadi-jisme-main-mehmaan-tha',
]);

function jpegSize(buf: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

const root = path.join(__dirname, '..', 'content', 'stories');
const ids = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'assets', 'cover.jpg')));

test('cover guide exists', () => {
  expect(fs.existsSync(path.join(__dirname, '..', 'docs', 'COVER_GUIDE.md'))).toBe(true);
});

test.each(ids)('%s cover is a JPEG portrait (2:3) unless grandfathered', (id) => {
  const buf = fs.readFileSync(path.join(root, id, 'assets', 'cover.jpg'));
  expect(buf[0] === 0xff && buf[1] === 0xd8).toBe(true);
  if (LEGACY_NON_PORTRAIT.has(id)) return;
  const { w, h } = jpegSize(buf);
  expect({ id, portrait: h >= w * 1.3 }).toEqual({ id, portrait: true });
});
