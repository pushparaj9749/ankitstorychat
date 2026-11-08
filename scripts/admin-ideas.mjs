#!/usr/bin/env node
/**
 * Print the pending Kissa story ideas / story submissions in a clean,
 * copy-pasteable form.
 *
 * The production worker keeps submissions in KV with a 24h TTL and exposes them
 * only behind `GET /api/admin/pending` with an `Authorization: Bearer <token>`
 * header. That header cannot be put in a browser address bar, so this script is
 * the shortest path: run it locally, keep the token in your shell, never in git.
 *
 * Usage
 *   ADMIN_TOKEN=... node scripts/admin-ideas.mjs
 *   ADMIN_TOKEN=... node scripts/admin-ideas.mjs --json      # raw JSON
 *   ADMIN_TOKEN=... node scripts/admin-ideas.mjs --url https://staging.example
 *
 * The token is read from the environment only. It is never written to disk and
 * never echoed in output.
 */
const DEFAULT_URL = 'https://beyondredeye.site';
const args = process.argv.slice(2);

function flag(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const token = process.env.ADMIN_TOKEN;
const base = flag('--url', DEFAULT_URL).replace(/\/+$/, '');
const asJson = args.includes('--json');

if (!token) {
  console.error('Set ADMIN_TOKEN first, e.g.\n  ADMIN_TOKEN=... node scripts/admin-ideas.mjs');
  process.exit(1);
}

const res = await fetch(`${base}/api/admin/pending`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const text = await res.text();

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(text.slice(0, 400));
  if (res.status === 401) console.error('\nToken rejected — check it in Settings → Admin, or rotate it.');
  process.exit(1);
}

const data = JSON.parse(text);
if (asJson) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const ideas = data.ideas ?? [];
const stories = data.stories ?? [];

const hoursLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 36e5)) : null;
};

function block(s, n) {
  const p = s.payload ?? {};
  const left = hoursLeft(s.expiresAt);
  const lines = [
    `──────────────────────────────────────────────`,
    `#${n}  ${p.title ?? s.title ?? '(untitled)'}`,
    `id:        ${s.id}`,
    `genre:     ${p.genre ?? s.genre ?? '—'}`,
    `by:        ${s.creator?.name ?? 'anon'}`,
    `sent:      ${s.submittedAt}`,
  ];
  if (left !== null) lines.push(`expires:   in ~${left}h  (24h TTL — accept/reject before then)`);
  if (p.characters) lines.push(`cast:      ${p.characters}`);
  if (p.notes) lines.push(`notes:     ${p.notes}`);
  lines.push('concept:', String(p.concept ?? '').trim(), '');
  return lines.join('\n');
}

console.log(`\nKissa — pending submissions @ ${base}`);
console.log(`ideas: ${ideas.length}   stories: ${stories.length}` +
  (data.remaining !== undefined ? `   submissions left today: ${data.remaining}` : ''));

if (!ideas.length && !stories.length) {
  console.log('\nKuch pending nahi hai (ya sab 24h TTL me expire ho gaye).\n');
} else {
  ideas.forEach((s, i) => console.log(block(s, i + 1)));
  if (stories.length) {
    console.log('══════════════ full story submissions ══════════════');
    stories.forEach((s, i) => console.log(block(s, i + 1)));
  }
  console.log('Tip: ye poora output copy karke agent ko de do — story package bana dega.\n');
}
