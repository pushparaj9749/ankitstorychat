#!/usr/bin/env node
/**
 * Turn the pending-submissions dump into GitHub Actions annotations.
 *
 * Why: artifacts and job logs sit behind storage hosts that some environments
 * (and some CI mirrors) cannot reach, but check-run annotations are plain API
 * data. So the workflow mirrors the list here and any reader can pull it with
 *   GET /repos/:owner/:repo/check-runs/:id/annotations
 *
 * Usage
 *   node scripts/emit-pending-annotations.mjs out/pending-ideas.txt
 */
import { readFileSync, existsSync } from 'node:fs';

const file = process.argv[2] ?? 'out/pending-ideas.txt';
const text = existsSync(file) ? readFileSync(file, 'utf8') : 'no output';

// workflow-command escaping
const esc = (v) => String(v).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

const RULE = '─'.repeat(46);
const chunks = [];
let blocks = text.split(RULE).map((b) => b.trim()).filter(Boolean);

// no submissions: still surface the summary line
if (!blocks.length) blocks = [text.trim()];

for (const [i, b] of blocks.entries()) {
  const first = (b.split('\n').find((l) => l.trim()) ?? `block ${i + 1}`).replace(/^#+\s*/, '').trim();
  const title = b.startsWith('Kissa') ? 'pending summary' : `idea ${i + 1}: ${first.slice(0, 100)}`;
  chunks.push(`::notice title=${esc(title)}::${esc(b.slice(0, 12000))}`);
}

// full dump as well, so nothing is lost to truncation
for (let i = 0; i < text.length; i += 45000) {
  chunks.push(`::notice title=${esc(`pending dump ${i / 45000 + 1}`)}::${esc(text.slice(i, i + 45000))}`);
}

console.log(chunks.join('\n'));
