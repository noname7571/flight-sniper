import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function connect(): Promise<void> {
  // Pool connects lazily, just ensure we can create it
  getPool();
}

export async function initSchema(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitored_routes (
        id SERIAL PRIMARY KEY,
        origin VARCHAR(3) NOT NULL,
        destination VARCHAR(3) NOT NULL,
        max_price DOUBLE PRECISION NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        email TEXT,
        discord_webhook TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        check_interval_minutes INTEGER NOT NULL DEFAULT 60,
        include_destinations TEXT,
        exclude_destinations TEXT,
        return_ticket INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        route_id INTEGER NOT NULL REFERENCES monitored_routes(id),
        price DOUBLE PRECISION NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        airline TEXT,
        departure_date TEXT,
        flight_number TEXT,
        direct INTEGER,
        seats_remaining INTEGER,
        booking_link TEXT,
        checked_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alert_log (
        id SERIAL PRIMARY KEY,
        route_id INTEGER NOT NULL REFERENCES monitored_routes(id),
        price DOUBLE PRECISION NOT NULL,
        max_price DOUBLE PRECISION NOT NULL,
        channel TEXT NOT NULL,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_route_id ON price_history(route_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_checked_at ON price_history(checked_at);
      CREATE INDEX IF NOT EXISTS idx_monitored_routes_active ON monitored_routes(active);
    `);

    // Safe migration: add columns if they don't exist
    try {
      await client.query('ALTER TABLE monitored_routes ADD COLUMN IF NOT EXISTS include_destinations TEXT');
      await client.query('ALTER TABLE monitored_routes ADD COLUMN IF NOT EXISTS exclude_destinations TEXT');
      await client.query('ALTER TABLE monitored_routes ADD COLUMN IF NOT EXISTS return_ticket INTEGER NOT NULL DEFAULT 0');
    } catch { /* columns may already exist */ }
  } finally {
    client.release();
  }
}

export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function get(sql: string, params: any[] = []): Promise<any | undefined> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return { lastInsertRowid: result.rows[0]?.id || 0, changes: result.rowCount || 0 };
  } finally {
    client.release();
  }
}
