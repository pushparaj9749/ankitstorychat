#!/usr/bin/env node
/**
 * CI helper: ensure the Kissa D1 database exists, apply its migrations and
 * wire the database id into worker/wrangler.jsonc.
 *
 * Uses Cloudflare's REST API directly (same style as ci-kv-setup.cjs) so no
 * dashboard click is needed and no ids are committed:
 *
 *   1. GET  /d1/database?name=kissa-db        → reuse if it exists
 *   2. POST /d1/database                      → create when missing
 *   3. POST /d1/database/<id>/query           → run migrations/0001_accounts.sql
 *   4. inject `"d1_databases": [{ binding: "KISSA_DB", ... }]` into wrangler.jsonc
 *
 * Environment: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN
 */
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_NAME = process.env.KISSA_DB_NAME || 'kissa-db';

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set.');
  process.exit(1);
}

// wrangler is run with cwd=worker/.
const Wrangler = path.resolve('wrangler.jsonc');
const MigrationsDir = path.resolve('migrations');

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
              return reject(
                new Error(`Cloudflare API ${res.statusCode} ${pathname}: ${JSON.stringify(json.errors)}`),
              );
            }
            resolve(json.result);
          } catch (e) {
            reject(
              new Error(`Cloudflare API ${res.statusCode} ${pathname}: non-JSON body: ${buf.slice(0, 400)}`),
            );
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function findOrCreateDatabase() {
  const list = await cfApi('GET', '/d1/database?per_page=100');
  const arr = Array.isArray(list) ? list : (list && list.result) || [];
  const hit = arr.find((d) => d && d.name === DB_NAME);
  if (hit) return { id: hit.uuid || hit.id, created: false };
  const created = await cfApi('POST', '/d1/database', { name: DB_NAME });
  return { id: created.uuid || created.id, created: true };
}

/** Strip `--` comment lines (keeping quoted text intact) and split on `;`. */
function splitStatements(sql) {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
  return withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runMigrations(dbId) {
  const files = fs
    .readdirSync(MigrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MigrationsDir, f), 'utf8');
    const statements = splitStatements(sql);
    // Every statement is idempotent (CREATE … IF NOT EXISTS / INSERT OR IGNORE),
    // so re-running the migration on each deploy is safe.
    for (const statement of statements) {
      try {
        await cfApi('POST', `/d1/database/${dbId}/query`, { sql: statement });
      } catch (e) {
        throw new Error(`migration ${f} failed on statement:\n${statement.slice(0, 200)}\n\n${e.message}`);
      }
    }
    console.log(`Applied migration ${f} (${statements.length} statements)`);
  }
}

function injectId(file, id) {
  let s = fs.readFileSync(file, 'utf8');
  const block = `\n  "d1_databases": [\n    { "binding": "KISSA_DB", "database_name": "${DB_NAME}", "database_id": "${id}" }\n  ],\n`;
  const existing = s.match(/^  "d1_databases"\s*:/m);
  if (existing) {
    const start = existing.index;
    const after = s.slice(start);
    const arrEnd = after.indexOf(']');
    s =
      s.slice(0, start) +
      `"d1_databases": [\n    { "binding": "KISSA_DB", "database_name": "${DB_NAME}", "database_id": "${id}" }\n  ]` +
      after.slice(arrEnd + 1);
  } else {
    s = s.replace(/(\n  "unsafe"\s*:\s*\{)/, block + '\n  "unsafe": {');
  }
  fs.writeFileSync(file, s);
}

/** Failure path: leave a readable GitHub annotation (logs may be inaccessible). */
function fail(message) {
  const clean = String(message || 'unknown error').replace(/\r?\n/g, ' ').slice(0, 900);
  console.error(clean);
  console.log(`::error title=D1 setup failed::${clean}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    try {
      fs.appendFileSync(summary, `### D1 setup failed\n\n\`\`\`\n${clean}\n\`\`\`\n`);
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
}

(async () => {
  console.log('Checking/creating Kissa D1 database via Cloudflare API...');
  const { id, created } = await findOrCreateDatabase();
  console.log(created ? 'Created D1 database:' : 'Reusing existing D1 database:', id);
  await runMigrations(id);
  injectId(Wrangler, id);
  console.log('Injected D1 id into', path.relative(process.cwd(), Wrangler));
})().catch((e) => fail(e && e.stack ? e.stack : e));
