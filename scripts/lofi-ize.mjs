#!/usr/bin/env node
/**
 * Turn a track you own into a "slowed + reverb" lofi version.
 *
 *   node scripts/lofi-ize.mjs input.wav [-o out.wav] [options]
 *
 * Options
 *   --speed=0.88      playback speed (lower = slower + deeper; 0.8–0.95 is the
 *                     usual lofi range; pitch drops with it, tape style)
 *   --reverb=0.38     reverb wet amount, 0–1
 *   --size=0.9        reverb size/length multiplier, 0.5–1.6
 *   --lowpass=3400    lowpass cutoff in Hz (the "blanket over the speakers")
 *   --vinyl=1         vinyl hiss + crackle amount, 0 = off
 *   --wobble=1        tape wow/flutter amount, 0 = off
 *   --fadein=1.5      seconds
 *   --fadeout=4       seconds
 *   --bits=16         16 or 24-bit output
 *
 * Only WAV in / WAV out, no dependencies — so it runs anywhere Node runs.
 *
 * IMPORTANT: this tool is for material you own — your own recordings, or
 * tracks whose licence allows derivatives. Slowing down somebody else's
 * release does not make it yours.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, basename } from 'node:path';

/* ---------------- CLI ---------------- */

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('-'));
if (!input) {
  console.error('usage: node scripts/lofi-ize.mjs input.wav [-o out.wav] [--speed=0.88] [--reverb=0.38]');
  process.exit(1);
}
const opt = (name, fallback) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  const value = eq === -1 ? args[args.indexOf(hit) + 1] : hit.slice(eq + 1);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
/** String option: accepts `-o out.wav`, `--out=out.wav` or `--out out.wav`. */
const strOpt = (name, fallback) => {
  const eq = args.find((a) => a === `--${name}` && false);
  void eq;
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(inline.indexOf('=') + 1);
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('-')) return args[i + 1];
  const short = name.length === 1 ? `-${name}` : null;
  if (short) {
    const j = args.indexOf(short);
    if (j >= 0 && args[j + 1] && !args[j + 1].startsWith('-')) return args[j + 1];
  }
  return fallback;
};

const speed = Math.min(1.2, Math.max(0.5, opt('speed', 0.88)));
const wet = Math.min(1, Math.max(0, opt('reverb', 0.38)));
const size = Math.min(1.8, Math.max(0.4, opt('size', 0.9)));
const lowpassHz = Math.max(400, opt('lowpass', 3400));
const vinyl = Math.min(2, Math.max(0, opt('vinyl', 1)));
const wobble = Math.min(2, Math.max(0, opt('wobble', 1)));
const fadeIn = Math.max(0, opt('fadein', 1.5));
const fadeOut = Math.max(0, opt('fadeout', 4));
const bits = opt('bits', 16) === 24 ? 24 : 16;
const outPath = strOpt('o', strOpt('out', join(dirname(input), `${basename(input, extname(input))}_lofi.wav`)));

/* ---------------- WAV read ---------------- */

function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let fmt = null;
  let data = null;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path}: missing fmt/data chunk`);
  if (![1, 3].includes(fmt.format)) throw new Error(`${path}: unsupported WAV format ${fmt.format}`);

  const { channels, bitsPerSample } = fmt;
  const bytes = bitsPerSample / 8;
  const frames = Math.floor(data.length / (bytes * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      const at = (f * channels + c) * bytes;
      let v;
      if (fmt.format === 3) v = data.readFloatLE(at);
      else if (bitsPerSample === 16) v = data.readInt16LE(at) / 32768;
      else if (bitsPerSample === 24) {
        const raw = data[at] | (data[at + 1] << 8) | (data[at + 2] << 16);
        v = ((raw << 8) >> 8) / 8388608;
      } else if (bitsPerSample === 8) v = (data[at] - 128) / 128;
      else if (bitsPerSample === 32) v = data.readInt32LE(at) / 2147483648;
      else throw new Error(`unsupported bit depth ${bitsPerSample}`);
      out[c][f] = v;
    }
  }
  return { sampleRate: fmt.sampleRate, channels: out };
}

/* ---------------- DSP ---------------- */

/** Playback-speed change with linear interpolation (+ optional tape wobble). */
function slowDown(ch, speedFactor, sr, wobbleAmount) {
  const outLen = Math.floor(ch.length / speedFactor);
  const out = new Float32Array(outLen);
  // wow (slow) + flutter (faster) both nudge the read head a little.
  const wowRate = 0.27;
  const flutterRate = 6.1;
  const depth = 0.0016 * wobbleAmount;
  for (let i = 0; i < outLen; i++) {
    const t = i / sr;
    const mod = depth * (Math.sin(2 * Math.PI * wowRate * t) + 0.35 * Math.sin(2 * Math.PI * flutterRate * t));
    const src = i * speedFactor * (1 + mod);
    const i0 = Math.floor(src);
    const frac = src - i0;
    const a = ch[i0] ?? 0;
    const b = ch[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** One-pole lowpass, applied twice for a steeper shoulder. */
function lowpass(buf, cutoffHz, sr, passes = 2) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sr);
  let lp = 0;
  for (let p = 0; p < passes; p++) {
    lp = 0;
    for (let i = 0; i < buf.length; i++) {
      lp += a * (buf[i] - lp);
      buf[i] = lp;
    }
  }
  return buf;
}

/**
 * Schroeder-style plate reverb: four damped comb filters into two allpasses.
 * Cheap, mono-safe, and it sits behind the vocal instead of washing it out.
 */
function reverb(input, sr, wetAmount, sizeFactor) {
  const len = input.length;
  const out = new Float32Array(len);
  const combDelays = [1687, 1601, 2053, 2251].map((d) => Math.max(2, Math.round((d / 44100) * sr * sizeFactor)));
  const allpassDelays = [347, 113].map((d) => Math.max(2, Math.round((d / 44100) * sr)));
  const feedback = 0.79;
  const damp = 0.42;

  const combs = combDelays.map((d) => ({ buf: new Float32Array(d), idx: 0, store: 0 }));
  const aps = allpassDelays.map((d) => ({ buf: new Float32Array(d), idx: 0 }));

  for (let i = 0; i < len; i++) {
    const x = input[i] * 0.25;
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.idx] = x + c.store * feedback;
      c.idx = (c.idx + 1) % c.buf.length;
      sum += y;
    }
    let y = sum * 0.25;
    for (const ap of aps) {
      const bufY = ap.buf[ap.idx];
      const outY = -y + bufY;
      ap.buf[ap.idx] = y + bufY * 0.5;
      ap.idx = (ap.idx + 1) % ap.buf.length;
      y = outY;
    }
    out[i] = y;
  }

  // Gentle pre-delay feel by mixing the tail slightly late.
  const mix = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    mix[i] = input[i] * (1 - wetAmount) + out[i] * wetAmount;
  }
  return mix;
}

/** Vinyl hiss + random crackle, deterministic (same input => same output). */
function addVinyl(buf, sr, amount) {
  if (amount <= 0) return buf;
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const hiss = 0.0022 * amount;
  for (let i = 0; i < buf.length; i++) buf[i] += (rnd() * 2 - 1) * hiss;
  const ticks = Math.round((buf.length / sr) * 7 * amount);
  for (let k = 0; k < ticks; k++) {
    const at = Math.floor(rnd() * buf.length);
    const len = 60 + Math.floor(rnd() * 240);
    const amp = (0.04 + rnd() * 0.1) * amount;
    for (let i = 0; i < len && at + i < buf.length; i++) {
      buf[at + i] += (rnd() * 2 - 1) * amp * Math.exp(-i / (len * 0.3));
    }
  }
  return buf;
}

function finalize(buf, sr, fadeInSec, fadeOutSec) {
  // Soft-saturate first, then normalise the result (tanh always loses a little
  // headroom, so normalising afterwards keeps the render at a usable level).
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.15);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const gain = peak > 0 ? 0.89 / peak : 1;
  const fi = Math.round(fadeInSec * sr);
  const fo = Math.round(fadeOutSec * sr);
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] * gain;
    if (i < fi) v *= i / fi;
    if (i > buf.length - fo) v *= Math.max(0, (buf.length - i) / fo);
    buf[i] = v;
  }
  return buf;
}

/* ---------------- WAV write ---------------- */

function writeWav(path, channels, sr, bitDepth) {
  const n = channels[0].length;
  const ch = channels.length;
  const bytesPer = bitDepth / 8;
  const dataSize = n * ch * bytesPer;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * bytesPer, 28);
  buf.writeUInt16LE(ch * bytesPer, 32);
  buf.writeUInt16LE(bitDepth, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let at = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      if (bitDepth === 16) {
        buf.writeInt16LE(Math.round(s * 32767), at);
        at += 2;
      } else {
        const v = Math.round(s * 8388607);
        buf.writeUIntLE(v < 0 ? v + 16777216 : v, at, 3);
        at += 3;
      }
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
  return buf.length;
}

/* ---------------- run ---------------- */

const { sampleRate, channels } = readWav(input);
const processed = channels.map((ch) => slowDown(ch, speed, sampleRate, wobble));
const revved = processed.map((ch) => reverb(ch, sampleRate, wet, size));
const shaped = revved.map((ch) => addVinyl(lowpass(ch, lowpassHz, sampleRate), sampleRate, vinyl));
const done = shaped.map((ch) => finalize(ch, sampleRate, fadeIn, fadeOut));
const bytes = writeWav(outPath, done, sampleRate, bits);

const outSeconds = done[0].length / sampleRate;
console.log(
  `${outPath}\n` +
    `  ${channels.length}ch · ${sampleRate} Hz · ${bits}-bit · ${outSeconds.toFixed(2)}s ` +
    `(${(bytes / 1e6).toFixed(2)} MB)\n` +
    `  speed ${speed} · reverb ${wet} · size ${size} · lowpass ${lowpassHz} Hz · vinyl ${vinyl} · wobble ${wobble}\n` +
    `  Reminder: only use audio you own or that is licensed for derivatives.`,
);
