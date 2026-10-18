/**
 * Web-only stand-in for `expo-sqlite`, used by `npx expo start --web` (UI review).
 *
 * Why: expo-sqlite's own web build runs wa-sqlite in a Worker and talks to it
 * through SharedArrayBuffer. That only works on a cross-origin-isolated page
 * (COOP/COEP on the HTML document), which Expo's dev server does not send for
 * the index page. It also can't work inside a cross-origin iframe preview. The
 * result was an app that hung on the splash screen in a normal browser.
 *
 * This adapter backs the exact API surface the app uses (openDatabaseAsync +
 * execAsync / runAsync / getAllAsync / getFirstAsync / withTransactionAsync)
 * with sql.js's asm.js build, a real SQLite with no Worker, wasm or SAB. The
 * database is persisted to localStorage so the profile, journeys and settings
 * survive a reload.
 *
 * metro.config.js swaps it in for platform === 'web' only. Native builds never
 * resolve this file. It is not part of the app bundle for Android/iOS.
 */
/* eslint-disable */
const initSqlJs = require('sql.js/dist/sql-asm.js');

const STORAGE_PREFIX = 'kissa-web-sqlite:';
let sqlJsPromise = null;

function getSqlJs() {
  if (!sqlJsPromise) sqlJsPromise = initSqlJs();
  return sqlJsPromise;
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** expo-sqlite accepts (sql, a, b), (sql, [a, b]) or (sql, { $a: 1 }). */
function normalizeParams(params) {
  let p = params;
  if (params.length === 1 && Array.isArray(params[0])) p = params[0];
  else if (params.length === 1 && params[0] && typeof params[0] === 'object' && !(params[0] instanceof Uint8Array)) {
    const named = {};
    for (const [k, v] of Object.entries(params[0])) named[k] = cleanValue(v);
    return named;
  }
  return p.map(cleanValue);
}

function cleanValue(v) {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

class WebSQLiteDatabase {
  constructor(name, db) {
    this.databaseName = name;
    this._db = db;
    this._saveTimer = null;
    this._txDepth = 0;
  }

  _persistSoon() {
    const ls = storage();
    if (!ls) return;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        ls.setItem(STORAGE_PREFIX + this.databaseName, toBase64(this._db.export()));
      } catch (e) {
        // Quota exceeded or private mode: keep working in memory.
        console.warn('[expo-sqlite web shim] could not persist database:', e && e.message);
      }
    }, 300);
  }

  async execAsync(source) {
    this._db.exec(source);
    this._persistSoon();
  }

  async runAsync(source, ...params) {
    this._db.run(source, normalizeParams(params));
    const changes = this._db.getRowsModified();
    const res = this._db.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowId = res.length ? Number(res[0].values[0][0]) : 0;
    this._persistSoon();
    return { changes, lastInsertRowId };
  }

  async getAllAsync(source, ...params) {
    const stmt = this._db.prepare(source);
    try {
      stmt.bind(normalizeParams(params));
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getFirstAsync(source, ...params) {
    const rows = await this.getAllAsync(source, ...params);
    return rows.length ? rows[0] : null;
  }

  async withTransactionAsync(task) {
    if (this._txDepth > 0) return task();
    this._txDepth++;
    this._db.exec('BEGIN');
    try {
      await task();
      this._db.exec('COMMIT');
    } catch (e) {
      try {
        this._db.exec('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      this._txDepth--;
      this._persistSoon();
    }
  }

  withExclusiveTransactionAsync(task) {
    return this.withTransactionAsync(() => task(this));
  }

  async closeAsync() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      const ls = storage();
      if (ls) ls.setItem(STORAGE_PREFIX + this.databaseName, toBase64(this._db.export()));
    }
  }
}

async function openDatabaseAsync(databaseName) {
  const SQL = await getSqlJs();
  const ls = storage();
  const saved = ls ? ls.getItem(STORAGE_PREFIX + databaseName) : null;
  let db;
  try {
    db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  } catch {
    db = new SQL.Database(); // corrupt snapshot: start fresh rather than hang
  }
  return new WebSQLiteDatabase(databaseName, db);
}

async function deleteDatabaseAsync(databaseName) {
  const ls = storage();
  if (ls) ls.removeItem(STORAGE_PREFIX + databaseName);
}

module.exports = {
  openDatabaseAsync,
  deleteDatabaseAsync,
  SQLiteDatabase: WebSQLiteDatabase,
};
