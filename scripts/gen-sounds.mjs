/**
 * Generate tiny original sound effects for Kissa (message blips + ambient loop).
 * Pure synthesized PCM — no copyrighted material. Run: node scripts/gen-sounds.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'sounds');
mkdirSync(outDir, { recursive: true });

const SR = 22050;

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Soft sine sweep with envelope. */
function sweep(dur, f0, f1, vol = 0.5) {
  const n = Math.floor(SR * dur);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 + (f1 - f0) * (i / n);
    const env = Math.sin((Math.PI * i) / n) ** 0.7; // smooth in/out
    out[i] = Math.sin(2 * Math.PI * f * t) * env * vol;
  }
  return out;
}

/** Dreamy pad: layered sines, slow attack, loop-safe (starts/ends at ~0). */
function pad(dur) {
  const n = Math.floor(SR * dur);
  const out = new Array(n);
  const freqs = [174.6, 261.6, 349.2, 523.25]; // F3 C4 F4 C5
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pos = i / n;
    const env = Math.sin(Math.PI * pos) ** 2; // 0 at both ends => seamless-ish loop
    let v = 0;
    freqs.forEach((f, k) => {
      v += Math.sin(2 * Math.PI * f * t + k * 1.7) * (0.22 / (k + 1));
    });
    // gentle shimmer
    v += Math.sin(2 * Math.PI * 880 * t) * 0.03 * Math.sin(2 * Math.PI * 0.4 * t);
    out[i] = v * env;
  }
  return out;
}

const send = sweep(0.18, 520, 880, 0.45);
const receive = sweep(0.22, 760, 480, 0.4);
const ambient = pad(10);

writeFileSync(join(outDir, 'send.wav'), toWav(send));
writeFileSync(join(outDir, 'receive.wav'), toWav(receive));
writeFileSync(join(outDir, 'ambient.wav'), toWav(ambient));
console.log('sounds written to assets/sounds/');
