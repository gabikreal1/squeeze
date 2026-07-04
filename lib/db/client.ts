import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DB_PATH = 'data/squeeze.db';

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const dbPath = process.env.DATABASE_PATH ?? DEFAULT_DB_PATH;
  return path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
}

function schemaPath(): string {
  return path.join(process.cwd(), 'lib/db/schema.sql');
}

export function getDb(): Database.Database {
  if (db) {
    return db;
  }

  const absolutePath = resolveDbPath();
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  db = new Database(absolutePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function runMigrations(): void {
  const schema = fs.readFileSync(schemaPath(), 'utf-8');
  getDb().exec(schema);
}
