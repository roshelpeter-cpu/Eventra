import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDatabase(filename) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
  }
  return db;
}

function addColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function migrate(db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const marker = '\n-- TRIGGERS\n';
  const splitAt = schema.indexOf(marker);
  const tables = splitAt === -1 ? schema : schema.slice(0, splitAt);
  const triggers = splitAt === -1 ? '' : schema.slice(splitAt + marker.length);
  db.exec(tables);
  addColumn(db, 'events', 'details', `TEXT NOT NULL DEFAULT '{}'`);
  addColumn(db, 'events', 'address', `TEXT NOT NULL DEFAULT ''`);
  addColumn(db, 'events', 'latitude', 'REAL');
  addColumn(db, 'events', 'longitude', 'REAL');
  addColumn(db, 'events', 'price_cents', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'events', 'currency', `TEXT NOT NULL DEFAULT 'INR'`);
  addColumn(db, 'registrations', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
  addColumn(db, 'registrations', 'ticket_label', `TEXT NOT NULL DEFAULT 'General admission'`);
  addColumn(db, 'registrations', 'amount_cents', 'INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'registrations', 'currency', `TEXT NOT NULL DEFAULT 'INR'`);
  if (triggers.trim()) db.exec(triggers);
  db.exec('PRAGMA foreign_keys = ON');
}

export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* The transaction may already have been rolled back by SQLite. */
    }
    throw error;
  }
}
