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

export function migrate(db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  const columns = db.prepare('PRAGMA table_info(events)').all().map((column) => column.name);
  if (!columns.includes('details')) {
    db.exec(`ALTER TABLE events ADD COLUMN details TEXT NOT NULL DEFAULT '{}'`);
  }
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
