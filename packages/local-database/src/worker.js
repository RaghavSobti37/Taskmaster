/**
 * Dedicated Web Worker: SQLite WASM with OPFS when available, else in-memory.
 * ponytail: OPFS needs COOP/COEP on parent origin; memory fallback for dev without headers.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { PILOT_SCHEMA_SQL } from './schema.js';

let db = null;

async function openDatabase() {
  const sqlite3 = await sqlite3InitModule({
    print: () => {},
    printErr: console.error,
  });

  if ('opfs' in sqlite3) {
    try {
      db = new sqlite3.oo1.OpfsDb('/coreknot-pilot.db');
    } catch {
      db = new sqlite3.oo1.DB(':memory:', 'c');
    }
  } else {
    db = new sqlite3.oo1.DB(':memory:', 'c');
  }

  db.exec(PILOT_SCHEMA_SQL);
  return db;
}

async function ensureDb() {
  if (!db) await openDatabase();
  return db;
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data ?? {};
  try {
    const database = await ensureDb();
    let result;

    switch (type) {
      case 'ping':
        result = { ok: true, storage: db?.filename ?? 'memory' };
        break;
      case 'exec':
        database.exec(payload.sql);
        result = { ok: true };
        break;
      case 'query': {
        const rows = [];
        database.exec({
          sql: payload.sql,
          bind: payload.params ?? [],
          rowMode: 'object',
          callback: (row) => rows.push(row),
        });
        result = { rows };
        break;
      }
      case 'run': {
        database.exec({
          sql: payload.sql,
          bind: payload.params ?? [],
        });
        result = { ok: true, changes: database.changes() };
        break;
      }
      case 'estimate':
        result = { ok: true };
        break;
      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }

    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message ?? String(error) });
  }
};
