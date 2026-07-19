export interface MonitoredRoute {
  id: number;
  origin: string;
  destination: string;
  max_price: number;
  currency: string;
  email: string | null;
  discord_webhook: string | null;
  active: number;
  check_interval_minutes: number;
  include_destinations: string | null;
  exclude_destinations: string | null;
  return_ticket: number;
  created_at: string;
  updated_at: string;
}

export interface PriceRecord {
  id: number;
  route_id: number;
  price: number;
  currency: string;
  airline: string | null;
  departure_date: string | null;
  flight_number: string | null;
  direct: number | null;
  seats_remaining: number | null;
  booking_link: string | null;
  checked_at: string;
}

export interface AlertRecord {
  id: number;
  route_id: number;
  route_origin: string;
  route_destination: string;
  price: number;
  max_price: number;
  channel: string;
  sent_at: string;
}

// Detect which database backend to use
// DATABASE_URL = PostgreSQL (production/Vercel/Railway)
// No DATABASE_URL = SQLite (local dev)
function getAdapter(): string {
  return process.env.DATABASE_URL ? 'postgres' : 'sqlite';
}

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;

  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    await pg.initSchema();
  } else {
    const sqlite = await import('./sqlite');
    sqlite.initSchema();
  }

  initialized = true;
}

export async function getAllRoutes(): Promise<MonitoredRoute[]> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    return pg.query('SELECT * FROM monitored_routes WHERE active = 1 ORDER BY id');
  }
  const sqlite = await import('./sqlite');
  return sqlite.query('SELECT * FROM monitored_routes WHERE active = 1 ORDER BY id');
}

export async function getRouteById(id: number): Promise<MonitoredRoute | undefined> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    return pg.get('SELECT * FROM monitored_routes WHERE id = $1', [id]);
  }
  const sqlite = await import('./sqlite');
  return sqlite.get('SELECT * FROM monitored_routes WHERE id = ?', [id]);
}

export async function createRoute(route: Omit<MonitoredRoute, 'id' | 'created_at' | 'updated_at'>): Promise<MonitoredRoute> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    const result = await pg.query(
      `INSERT INTO monitored_routes (origin, destination, max_price, currency, email, discord_webhook, active, check_interval_minutes, include_destinations, exclude_destinations, return_ticket)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [route.origin, route.destination, route.max_price, route.currency, route.email, route.discord_webhook, route.active, route.check_interval_minutes, route.include_destinations, route.exclude_destinations, route.return_ticket]
    );
    return result[0];
  }
  const sqlite = await import('./sqlite');
  const result = await sqlite.run(
    `INSERT INTO monitored_routes (origin, destination, max_price, currency, email, discord_webhook, active, check_interval_minutes, include_destinations, exclude_destinations, return_ticket)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [route.origin, route.destination, route.max_price, route.currency, route.email, route.discord_webhook, route.active, route.check_interval_minutes, route.include_destinations, route.exclude_destinations, route.return_ticket]
  );
  return (await getRouteById(result.lastInsertRowid))!;
}

export async function updateRoute(id: number, updates: Partial<MonitoredRoute>): Promise<MonitoredRoute | undefined> {
  await ensureInit();
  const adapter = getAdapter();
  const fields: string[] = [];
  const values: any[] = [];

  const allowedFields = ['origin', 'destination', 'max_price', 'currency', 'email', 'discord_webhook', 'active', 'check_interval_minutes', 'include_destinations', 'exclude_destinations', 'return_ticket'];
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      if (adapter === 'postgres') {
        fields.push(`${key} = $${fields.length + 1}`);
      } else {
        fields.push(`${key} = ?`);
      }
      values.push(value);
    }
  }

  if (fields.length === 0) return getRouteById(id);

  if (adapter === 'postgres') {
    fields.push('updated_at = NOW()');
    values.push(id);
    const pg = await import('./postgres');
    await pg.query(`UPDATE monitored_routes SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  } else {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    const sqlite = await import('./sqlite');
    await sqlite.run(`UPDATE monitored_routes SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  return getRouteById(id);
}

export async function deleteRoute(id: number): Promise<void> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    await pg.query('DELETE FROM monitored_routes WHERE id = $1', [id]);
  } else {
    const sqlite = await import('./sqlite');
    await sqlite.run('DELETE FROM monitored_routes WHERE id = ?', [id]);
  }
}

export async function savePriceRecord(record: Omit<PriceRecord, 'id' | 'checked_at'>): Promise<void> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    await pg.query(
      `INSERT INTO price_history (route_id, price, currency, airline, departure_date, flight_number, direct, seats_remaining, booking_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [record.route_id, record.price, record.currency, record.airline, record.departure_date, record.flight_number, record.direct, record.seats_remaining, record.booking_link]
    );
  } else {
    const sqlite = await import('./sqlite');
    await sqlite.run(
      `INSERT INTO price_history (route_id, price, currency, airline, departure_date, flight_number, direct, seats_remaining, booking_link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.route_id, record.price, record.currency, record.airline, record.departure_date, record.flight_number, record.direct, record.seats_remaining, record.booking_link]
    );
  }
}

export async function getPriceHistory(routeId: number, limit: number = 50): Promise<PriceRecord[]> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    return pg.query('SELECT * FROM price_history WHERE route_id = $1 ORDER BY checked_at DESC LIMIT $2', [routeId, limit]);
  }
  const sqlite = await import('./sqlite');
  return sqlite.query('SELECT * FROM price_history WHERE route_id = ? ORDER BY checked_at DESC LIMIT ?', [routeId, limit]);
}

export async function logAlert(routeId: number, price: number, maxPrice: number, channel: string): Promise<void> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    await pg.query('INSERT INTO alert_log (route_id, price, max_price, channel) VALUES ($1, $2, $3, $4)', [routeId, price, maxPrice, channel]);
  } else {
    const sqlite = await import('./sqlite');
    await sqlite.run('INSERT INTO alert_log (route_id, price, max_price, channel) VALUES (?, ?, ?, ?)', [routeId, price, maxPrice, channel]);
  }
}

export async function getAlerts(limit: number = 50, offset: number = 0): Promise<AlertRecord[]> {
  await ensureInit();
  const adapter = getAdapter();
  const query = `
    SELECT a.id, a.route_id, a.price, a.max_price, a.channel, a.sent_at,
           r.origin as route_origin, r.destination as route_destination
    FROM alert_log a
    LEFT JOIN monitored_routes r ON a.route_id = r.id
    ORDER BY a.sent_at DESC
    LIMIT ? OFFSET ?
  `;
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    return pg.query(query.replace(/\?/g, '$1').replace('$1OFFSET', '$2 OFFSET'), [limit, offset]);
  }
  const sqlite = await import('./sqlite');
  return sqlite.query(query, [limit, offset]);
}

export async function getAlertCount(): Promise<number> {
  await ensureInit();
  const adapter = getAdapter();
  if (adapter === 'postgres') {
    const pg = await import('./postgres');
    const result = await pg.get('SELECT COUNT(*) as count FROM alert_log');
    return result?.count || 0;
  }
  const sqlite = await import('./sqlite');
  const result = await sqlite.get('SELECT COUNT(*) as count FROM alert_log');
  return result?.count || 0;
}
