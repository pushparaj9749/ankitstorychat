#!/usr/bin/env node
/**
 * CI helper: ensure the KISSA_SUBMISSIONS KV namespace exists and inject its
 * id into worker/wrangler.jsonc. Runs from the repo root.
 *
 * Reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from env (provided by the
 * GitHub Actions workflow) and shells out to `wrangler` which picks them up.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const Wrangler = path.resolve(__dirname, '..', 'worker', 'wrangler.jsonc');

function run(cmd, opts = {}) {
  console.log('$', cmd);
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  } catch (e) {
    process.stderr.write(e.stderr || '');
    throw e;
  }
}

function findExistingId(listOut) {
  // Wrangler prints a JSON array. Try to parse; on older versions it prints a table.
  try {
    const arr = JSON.parse(listOut);
    const hit = Array.isArray(arr) && arr.find((x) => x && x.title === 'KISSA_SUBMISSIONS');
    if (hit && hit.id) return String(hit.id);
  } catch { /* fall through */ }
  // Table fallback.
  const m = listOut.match(/KISSA_SUBMISSIONS\s+([a-f0-9]{32,})/);
  return m ? m[1] : '';
}

function extractId(createOut) {
  // wrangler prints either `id = <hex>` or JSON; accept either.
  let m = createOut.match(/id\s*=\s*([a-f0-9]{32,})/);
  if (m) return m[1];
  m = createOut.match(/"id"\s*:\s*"([a-f0-9]{32,})"/);
  return m ? m[1] : '';
}

function injectId(file, id) {
  let s = fs.readFileSync(file, 'utf8');
  const block = `\n  "kv_namespaces": [\n    { "binding": "KISSA_SUBMISSIONS", "id": "${id}", "preview_id": "${id}" }\n  ],\n`;
  if (s.includes('"kv_namespaces"')) {
    s = s.replace(
      /"kv_namespaces"\s*:\s*\[[\s\S]*?\]/m,
      `"kv_namespaces": [\n    { "binding": "KISSA_SUBMISSIONS", "id": "${id}", "preview_id": "${id}" }\n  ]`,
    );
  } else {
    // Insert immediately before the "unsafe" block so the config stays valid.
    s = s.replace(/(\n  "unsafe"\s*:\s*\{)/, block + '\n  "unsafe": {');
  }
  fs.writeFileSync(file, s);
}

function main() {
  console.log('Checking for existing KISSA_SUBMISSIONS namespace...');
  let id = '';
  try {
    id = findExistingId(run('npx wrangler kv:namespace list'));
  } catch (e) {
    console.warn('kv:namespace list failed (will create fresh):', e.message);
  }
  if (!id) {
    console.log('Creating KISSA_SUBMISSIONS KV namespace...');
    const out = run('npx wrangler kv:namespace create KISSA_SUBMISSIONS');
    id = extractId(out);
    if (!id) {
      console.error('Could not parse namespace id from wrangler output:\n' + out);
      process.exit(1);
    }
    console.log('Created KV namespace:', id);
  } else {
    console.log('Reusing existing KV namespace:', id);
  }
  injectId(Wrangler, id);
  console.log('Injected KV id into', path.relative(process.cwd(), Wrangler));
}

main();
