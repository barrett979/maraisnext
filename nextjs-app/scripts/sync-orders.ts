#!/usr/bin/env npx tsx
/**
 * MoySklad Orders Sync Script
 *
 * Imports orders from MoySklad API to local SQLite database.
 * Uses UPSERT to avoid duplicates.
 *
 * Usage:
 *   npx tsx scripts/sync-orders.ts [maxOrders]
 *
 * Examples:
 *   npx tsx scripts/sync-orders.ts          # Import last 10000 orders (default)
 *   npx tsx scripts/sync-orders.ts 5000     # Import last 5000 orders
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';

// Config
const DEFAULT_MAX_ORDERS = 10000;
const BATCH_SIZE = 100;

// Database path (same as Yandex data)
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), 'data')
  : path.join(process.cwd(), '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'yandex_direct.db');

// MoySklad API
const MOYSKLAD_API = 'https://api.moysklad.ru/api/remap/1.2';
const INVOICE_ATTR_ID = '5e0144d9-cdd7-11eb-0a80-0955003bee8a';
const COURIER_ATTR_ID = 'c56e42be-1523-11ea-0a80-04630026f65f';

interface Order {
  id: string;
  order_n: string;
  date: string;
  total: number;
  status: string;
  paid: number;
  customer_id: string;
  y_orderid: string | null;
  courier: string | null;
}

// Get MoySklad token
async function getToken(): Promise<string> {
  const username = process.env.MOYSKLAD_USERNAME;
  const password = process.env.MOYSKLAD_PASSWORD;

  if (!username || !password) {
    throw new Error('MOYSKLAD_USERNAME and MOYSKLAD_PASSWORD are required');
  }

  const basic = Buffer.from(`${username}:${password}`).toString('base64');
  const response = await fetch(`${MOYSKLAD_API}/security/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch courier name by ID
async function fetchCourierName(token: string, rowId: string): Promise<string> {
  const url = `${MOYSKLAD_API}/entity/customentity/${COURIER_ATTR_ID}/rows/${rowId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return '';

  const data = await response.json();
  return data.name || '';
}

// Fetch orders from MoySklad
async function fetchOrders(token: string, offset: number, limit: number): Promise<unknown[]> {
  const url = `${MOYSKLAD_API}/entity/customerorder?limit=${limit}&offset=${offset}&order=created,desc&expand=state,agent,attributes.value`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.status}`);
  }

  const data = await response.json();
  return data.rows || [];
}

// Parse order from MoySklad response
async function parseOrder(token: string, raw: Record<string, unknown>): Promise<Order> {
  const attrs = (raw.attributes as Array<Record<string, unknown>>) || [];

  // Find invoice number
  const invoiceAttr = attrs.find(a => a.id === INVOICE_ATTR_ID);
  const yOrderId = invoiceAttr ? String(invoiceAttr.value || '') : null;

  // Find courier
  const courierAttr = attrs.find(a => a.id === COURIER_ATTR_ID);
  let courier: string | null = null;

  if (courierAttr) {
    const val = courierAttr.value as Record<string, unknown> | string;
    if (typeof val === 'object' && val !== null) {
      courier = (val.name as string) || await fetchCourierName(token, val.id as string);
    } else if (typeof val === 'string') {
      courier = val;
    }
  }

  const state = raw.state as Record<string, unknown> | undefined;
  const agent = raw.agent as Record<string, unknown> | undefined;
  const createdDate = new Date(raw.created as string);

  return {
    id: raw.id as string,
    order_n: raw.name as string,
    date: createdDate.toISOString().replace('T', ' ').slice(0, 19),
    total: (raw.sum as number) / 100,
    status: (state?.name as string || '').trim(),
    paid: ((raw.payedSum as number) || 0) / 100,
    customer_id: (agent?.id as string) || '',
    y_orderid: yOrderId || null,
    courier: courier,
  };
}

// Ensure table exists
function ensureTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS moysklad_orders (
      id TEXT PRIMARY KEY,
      order_n TEXT,
      date TEXT,
      total REAL,
      status TEXT,
      paid REAL,
      customer_id TEXT,
      y_orderid TEXT,
      courier TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_moysklad_orders_date ON moysklad_orders(date);
    CREATE INDEX IF NOT EXISTS idx_moysklad_orders_status ON moysklad_orders(status);
    CREATE INDEX IF NOT EXISTS idx_moysklad_orders_courier ON moysklad_orders(courier);
  `);
}

// Main sync function
async function syncOrders(maxOrders: number): Promise<void> {
  console.log(`[MoySklad Sync] Starting import of up to ${maxOrders} orders...`);
  console.log(`[MoySklad Sync] Database: ${DB_PATH}`);

  const db = new Database(DB_PATH);

  try {
    // Ensure table exists
    ensureTable(db);
    console.log('[MoySklad Sync] Table ready');

    // Get token
    const token = await getToken();
    console.log('[MoySklad Sync] Authenticated');

    // Prepare upsert statement
    const upsert = db.prepare(`
      INSERT INTO moysklad_orders (id, order_n, date, total, status, paid, customer_id, y_orderid, courier, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        order_n = excluded.order_n,
        date = excluded.date,
        total = excluded.total,
        status = excluded.status,
        paid = excluded.paid,
        customer_id = excluded.customer_id,
        y_orderid = excluded.y_orderid,
        courier = excluded.courier,
        updated_at = CURRENT_TIMESTAMP
    `);

    let offset = 0;
    let totalImported = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (totalImported < maxOrders) {
      const rawOrders = await fetchOrders(token, offset, BATCH_SIZE);

      if (rawOrders.length === 0) {
        console.log('[MoySklad Sync] No more orders to fetch');
        break;
      }

      const orders: Order[] = [];

      for (const raw of rawOrders) {
        const order = await parseOrder(token, raw as Record<string, unknown>);

        // Skip today's orders (incomplete data)
        const orderDate = new Date(order.date);
        if (orderDate >= today) continue;

        orders.push(order);

        if (orders.length + totalImported >= maxOrders) break;
      }

      // Batch insert with transaction
      if (orders.length > 0) {
        const insertMany = db.transaction((ordersToInsert: Order[]) => {
          for (const order of ordersToInsert) {
            upsert.run(
              order.id,
              order.order_n,
              order.date,
              order.total,
              order.status,
              order.paid,
              order.customer_id,
              order.y_orderid,
              order.courier
            );
          }
        });

        insertMany(orders);
        totalImported += orders.length;
        console.log(`[MoySklad Sync] Processed ${totalImported}/${maxOrders} orders`);
      }

      offset += BATCH_SIZE;

      if (totalImported >= maxOrders) break;
    }

    // Get final count
    const count = db.prepare('SELECT COUNT(*) as count FROM moysklad_orders').get() as { count: number };
    console.log(`[MoySklad Sync] Completed! Imported: ${totalImported}, Total in DB: ${count.count}`);

  } finally {
    db.close();
  }
}

// Run
const maxOrders = parseInt(process.argv[2] || String(DEFAULT_MAX_ORDERS), 10);

syncOrders(maxOrders)
  .then(() => {
    console.log('[MoySklad Sync] Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[MoySklad Sync] Error:', error);
    process.exit(1);
  });
