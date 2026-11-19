#!/usr/bin/env node
/**
 * Generate an ORIGINAL slow "lofi romantic" bed for Kissa promos/reels.
 *
 *   node scripts/gen-lofi-bed.mjs [seconds] [bpm]
 *
 * Nothing is sampled and no existing song is referenced: every note is
 * synthesised here (chords, bass, sparse melody, soft kick/rim, vinyl crackle
 * and tape wobble). Output is mono 32 kHz WAV, safe to publish and to ship in
 * the app.
 *
 * Defaults: 60 seconds at 68 BPM in A minor (Am7 – Fmaj7 – Cmaj7 – G6), which
 * is the mood of the reference track the owner asked about without copying it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 32000;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs', 'promo', 'music');
const outFile = join(outDir, 'kissa_lofi_romantic.wav');

const seconds = Number(process.argv[2] ?? 60);
const bpm = Number(process.argv[3] ?? 68);
const beat = 60 / bpm;
const barLength = beat * 4;
const total = Math.round(seconds * SR);
const buf = new Float32Array(total);

/* ---------- tiny deterministic RNG so every run sounds the same ---------- */
let seed = 20261119;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/* ---------- voices ---------- */

/** Warm pad tone: sine + soft 2nd/3rd partials, slow attack/release. */
function pad(midi, start, dur, gain = 0.12, detune = 0) {
  const f0 = hz(midi) * (1 + detune);
  const a = Math.round(0.55 * SR);
  const r = Math.round(0.9 * SR);
  const n = Math.round(dur * SR);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / SR;
    const env =
      (i < a ? i / a : 1) * (i > n - r ? Math.max(0, (n - i) / r) : 1);
    // gentle tape wobble
    const wob = 1 + 0.0015 * Math.sin(2 * Math.PI * 0.23 * t + detune * 40);
    const ph = 2 * Math.PI * f0 * wob * t;
    const v =
      Math.sin(ph) +
      0.42 * Math.sin(2 * ph) +
      0.16 * Math.sin(3 * ph) +
      0.05 * Math.sin(4 * ph);
    buf[s0 + i] += v * env * gain * 0.5;
  }
}

/** Soft round bass. */
function bass(midi, start, dur, gain = 0.3) {
  const f0 = hz(midi);
  const n = Math.round(dur * SR);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / SR;
    const env = Math.min(1, i / (0.02 * SR)) * Math.exp(-t * 1.5);
    buf[s0 + i] += (Math.sin(2 * Math.PI * f0 * t) + 0.18 * Math.sin(4 * Math.PI * f0 * t)) * env * gain;
  }
}

/** Sparse plucked melody note (triangle-ish, short decay). */
function pluck(midi, start, dur = 1.1, gain = 0.16) {
  const f0 = hz(midi);
  const n = Math.round(dur * SR);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / SR;
    const env = Math.min(1, i / (0.006 * SR)) * Math.exp(-t * 3.2);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t * 2);
    const ph = 2 * Math.PI * f0 * vib * t;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
    buf[s0 + i] += (tri + 0.25 * Math.sin(2 * ph)) * env * gain;
  }
}

/** Soft kick (sine drop) and rim (filtered click). */
function kick(start, gain = 0.42) {
  const n = Math.round(0.35 * SR);
  const s0 = Math.round(start * SR);
  let phase = 0;
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / SR;
    const f = 96 * Math.exp(-t * 9) + 44;
    phase += (2 * Math.PI * f) / SR;
    buf[s0 + i] += Math.sin(phase) * Math.exp(-t * 7) * gain;
  }
}

function rim(start, gain = 0.1) {
  const n = Math.round(0.12 * SR);
  const s0 = Math.round(start * SR);
  for (let i = 0; i < n && s0 + i < total; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 45);
    const noise = rnd() * 2 - 1;
    buf[s0 + i] += (noise * 0.7 + Math.sin(2 * Math.PI * 1650 * t) * 0.4) * env * gain;
  }
}

/** Vinyl crackle + hiss, deliberately uneven. */
function vinyl() {
  for (let i = 0; i < total; i++) {
    buf[i] += (rnd() * 2 - 1) * 0.0035;
  }
  const ticks = Math.round((total / SR) * 9);
  for (let k = 0; k < ticks; k++) {
    const at = Math.floor(rnd() * total);
    const len = 90 + Math.floor(rnd() * 260);
    const amp = 0.05 + rnd() * 0.12;
    for (let i = 0; i < len && at + i < total; i++) {
      buf[at + i] += (rnd() * 2 - 1) * amp * Math.exp(-i / (len * 0.35));
    }
  }
}

/* ---------- arrangement ---------- */
// Am7, Fmaj7, Cmaj7, G6 — voiced close and low so the pad stays soft.
const chords = [
  { pad: [57, 60, 64, 67], bass: 45 },
  { pad: [53, 57, 60, 64], bass: 41 },
  { pad: [48, 55, 59, 64], bass: 36 },
  { pad: [55, 59, 62, 64], bass: 43 },
];

const bars = Math.ceil(seconds / barLength);
// A pentatonic-ish melody that only lands on strong-ish beats; seeded so it
// stays identical between runs.
const scale = [69, 72, 74, 76, 79, 81, 84];

for (let b = 0; b < bars; b++) {
  const t0 = b * barLength;
  if (t0 >= seconds) break;
  const chord = chords[b % chords.length];

  // pad: one long chord per bar, slightly detuned doubles
  for (const m of chord.pad) {
    pad(m, t0, barLength * 0.98, 0.1, 0);
    pad(m, t0 + 0.02, barLength * 0.96, 0.055, 0.0018);
  }

  // bass: root on 1, fifth-ish pickup on 3.5
  bass(chord.bass, t0, beat * 1.6, 0.28);
  bass(chord.bass, t0 + beat * 2.5, beat * 1.2, 0.2);

  // drums: soft kick on 1 and 3, rim offbeats
  kick(t0, 0.4);
  kick(t0 + beat * 2, 0.3);
  rim(t0 + beat * 2.5, 0.08);
  rim(t0 + beat * 3.5, 0.06);

  // melody: 0–3 notes per bar, denser in the second half
  const density = b < bars * 0.35 ? 2 : 3;
  const notes = 1 + Math.floor(rnd() * density);
  for (let k = 0; k < notes; k++) {
    const at = t0 + beat * (Math.floor(rnd() * 8) / 2);
    const m = scale[Math.floor(rnd() * scale.length)];
    if (at < seconds - 0.4) pluck(m, at, 1.4, 0.11);
  }
}

vinyl();

/* ---------- tone shaping: one-pole lowpass + soft clip + fades ---------- */
let lp = 0;
const cutoff = 0.16; // 0..1 — fairly dark, tape-like
for (let i = 0; i < total; i++) {
  lp += cutoff * (buf[i] - lp);
  buf[i] = lp;
}

let peak = 0;
for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0 ? 0.82 / peak : 1;

const fadeIn = Math.round(1.2 * SR);
const fadeOut = Math.round(3.0 * SR);
for (let i = 0; i < total; i++) {
  let v = Math.tanh(buf[i] * norm * 1.15);
  if (i < fadeIn) v *= i / fadeIn;
  if (i > total - fadeOut) v *= Math.max(0, (total - i) / fadeOut);
  buf[i] = v;
}

/* ---------- 16-bit mono WAV ---------- */
const bytes = Buffer.alloc(44 + total * 2);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(36 + total * 2, 4);
bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(SR, 24);
bytes.writeUInt32LE(SR * 2, 28);
bytes.writeUInt16LE(2, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(total * 2, 40);
for (let i = 0; i < total; i++) {
  const s = Math.max(-1, Math.min(1, buf[i]));
  bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, bytes);
console.log(`${outFile} — ${seconds}s, ${bpm} BPM, ${(bytes.length / 1e6).toFixed(2)} MB, original synthesis`);
