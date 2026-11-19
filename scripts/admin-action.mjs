#!/usr/bin/env node
/**
 * Run the queued admin actions (accept / reject) from a plain text file.
 *
 * The worker only exposes accept/reject as POST routes behind the Bearer token,
 * and that token must stay a repository secret. So the queue file is committed
 * with plain, public ids and CI — which does have the token — performs the call:
 *
 *   .github/admin/queue.txt
 *     accept idea_mwnl6fmj_xgye2tof
 *     reject story_abc123_def456
 *
 * Short form (`accept` / `reject`) infers idea vs story from the id prefix;
 * `accept-idea`, `reject-story`, ... also work.
 *
 * Usage
 *   ADMIN_TOKEN=... node scripts/admin-action.mjs [.github/admin/queue.txt]
 *   ADMIN_TOKEN=... node scripts/admin-action.mjs --dry-run
 *
 * Comments (`#`) and blank lines are ignored. The token is read from the
 * environment only — it is never written to disk or echoed.
 */
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--')) ?? '.github/admin/queue.txt';
const base = (process.env.BASE ?? 'https://beyondredeye.site').replace(/\/+$/, '');
const token = process.env.ADMIN_TOKEN;

const ROUTES = {
  'accept-idea': (id) => `/api/admin/idea/${id}/accept`,
  'reject-idea': (id) => `/api/admin/idea/${id}/reject`,
  'accept-story': (id) => `/api/admin/story/${id}/accept`,
  'reject-story': (id) => `/api/admin/story/${id}/reject`,
};

/** Submission ids are server-generated: idea_/story_ + lowercase alnum runs. */
const ID_RE = /^[a-z]+_[a-z0-9]{4,32}_[a-z0-9]{4,32}$/;

if (!existsSync(file)) {
  console.log(`${file} not found — nothing queued.`);
  process.exit(0);
}

const lines = readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (lines.length === 0) {
  console.log('queue is empty — nothing to do.');
  process.exit(0);
}

if (!token) {
  console.error('ADMIN_TOKEN is not set — cannot run admin actions.');
  process.exit(1);
}

let failures = 0;
for (const line of lines) {
  const [rawAction, id, ...rest] = line.split(/\s+/);
  if (!ID_RE.test(id ?? '')) {
    console.error(`::warning title=Bad id::"${id}" does not look like a submission id`);
    failures++;
    continue;
  }
  // `accept` / `reject` infer the type from the submission id prefix.
  const kind = id.startsWith('story_') ? 'story' : id.startsWith('idea_') ? 'idea' : '';
  const action = ROUTES[rawAction] ? rawAction : kind ? `${rawAction}-${kind}` : '';
  const route = ROUTES[action];
  if (!route) {
    console.error(`::warning title=Unknown action::"${rawAction}" — expected ${Object.keys(ROUTES).join(' | ')}`);
    failures++;
    continue;
  }
  if (rest.length) {
    console.error(`::warning title=Extra words::${line} — only "<action> <id>" is used`);
  }

  const url = `${base}${route(id)}`;
  if (dryRun) {
    console.log(`[dry-run] POST ${url}`);
    continue;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = (await res.text()).slice(0, 300);
  if (res.ok) {
    console.log(`::notice title=Admin action ok::${action} ${id} → HTTP ${res.status}`);
  } else {
    console.error(`::error title=Admin action failed::${action} ${id} → HTTP ${res.status} ${text}`);
    failures++;
  }
}

process.exit(failures ? 1 : 0);
