#!/usr/bin/env node
/**
 * CI helper: ensure the KISSA_SUBMISSIONS KV namespace exists and inject its
 * id into worker/wrangler.jsonc.
 *
 * Uses Cloudflare's REST API directly (no reliance on wrangler CLI formatting)
 * — reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from env.
 */
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set.');
  process.exit(1);
}

// Wrangler is at cwd=worker/ when run from the workflow.
const Wrangler = path.resolve('wrangler.jsonc');

function cfApi(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.cloudflare.com',
        port: 443,
        path: `/client/v4/accounts/${ACCOUNT_ID}${pathname}`,
        method,
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(buf);
            if (!json.success) {
              return reject(new Error(`Cloudflare API ${res.statusCode} ${pathname}: ${JSON.stringify(json.errors)}`));
            }
            resolve(json.result);
          } catch (e) {
            reject(new Error(`Cloudflare API ${res.statusCode} ${pathname}: non-JSON body: ${buf.slice(0, 400)}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function findOrCreateNamespace(title) {
  const namespaces = await cfApi('GET', `/storage/kv/namespaces?per_page=100`);
  const hit = Array.isArray(namespaces) && namespaces.find((n) => n.title === title);
  if (hit) return { id: hit.id, created: false };
  const created = await cfApi('POST', `/storage/kv/namespaces`, { title });
  return { id: created.id, created: true };
}

function injectId(file, id) {
  let s = fs.readFileSync(file, 'utf8');
  const block = `\n  "kv_namespaces": [\n    { "binding": "KISSA_SUBMISSIONS", "id": "${id}", "preview_id": "${id}" }\n  ],\n`;
  const existing = s.match(/^  "kv_namespaces"\s*:/m);
  if (existing) {
    const start = existing.index;
    const after = s.slice(start);
    const arrEnd = after.indexOf(']');
    s = s.slice(0, start) + `"kv_namespaces": [\n    { "binding": "KISSA_SUBMISSIONS", "id": "${id}", "preview_id": "${id}" }\n  ]` + after.slice(arrEnd + 1);
  } else {
    s = s.replace(/(\n  "unsafe"\s*:\s*\{)/, block + '\n  "unsafe": {');
  }
  fs.writeFileSync(file, s);
}

(async () => {
  console.log('Checking/creating KISSA_SUBMISSIONS KV namespace via Cloudflare API...');
  const { id, created } = await findOrCreateNamespace('KISSA_SUBMISSIONS');
  console.log(created ? 'Created KV namespace:' : 'Reusing existing KV namespace:', id);
  injectId(Wrangler, id);
  console.log('Injected KV id into', path.relative(process.cwd(), Wrangler));
})().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
