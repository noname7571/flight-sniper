import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../../data/flights.db');

let db: Database.Database;

export function connect(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initSchema(): void {
  const database = connect();
  database.exec(`
    CREATE TABLE IF NOT EXISTS monitored_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      max_price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      email TEXT,
      discord_webhook TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      check_interval_minutes INTEGER NOT NULL DEFAULT 60,
      include_destinations TEXT,
      exclude_destinations TEXT,
      return_ticket INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      airline TEXT,
      departure_date TEXT,
      flight_number TEXT,
      direct INTEGER,
      seats_remaining INTEGER,
      booking_link TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (route_id) REFERENCES monitored_routes(id)
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      price REAL NOT NULL,
      max_price REAL NOT NULL,
      channel TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (route_id) REFERENCES monitored_routes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_route_id ON price_history(route_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at);
    CREATE INDEX IF NOT EXISTS idx_monitored_routes_active ON monitored_routes(active);
  `);

  // Safe migration: add columns if they don't exist (SQLite ignores errors for duplicate ALTER TABLE)
  try {
    database.exec('ALTER TABLE monitored_routes ADD COLUMN include_destinations TEXT');
  } catch { /* column already exists */ }
  try {
    database.exec('ALTER TABLE monitored_routes ADD COLUMN exclude_destinations TEXT');
  } catch { /* column already exists */ }
  try {
    database.exec('ALTER TABLE monitored_routes ADD COLUMN return_ticket INTEGER NOT NULL DEFAULT 0');
  } catch { /* column already exists */ }
}

export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const database = connect();
  const stmt = database.prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    return stmt.all(...params);
  }
  stmt.run(...params);
  return [];
}

export async function get(sql: string, params: any[] = []): Promise<any | undefined> {
  const database = connect();
  return database.prepare(sql).get(...params);
}

export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const database = connect();
  const result = database.prepare(sql).run(...params);
  return { lastInsertRowid: result.lastInsertRowid as number, changes: result.changes };
}
