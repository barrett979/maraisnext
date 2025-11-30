/**
 * Import products from Airtable into SQLite
 * Usage: npx tsx scripts/sync-airtable-products.ts
 *
 * This script:
 * 1. Fetches all products from Airtable
 * 2. Resolves linked records (shipment_id, shooting_ids) to get actual IDs
 * 3. Stores in pipeline_products SQLite table
 */

import Database from 'better-sqlite3';
import path from 'path';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDgAaPpN2ZNh0Cx';
const PRODUCTS_TABLE_ID = 'tblHssX3y2bSDio6H';
const SHIPMENTS_TABLE = 'shipments';
const SHOOTINGS_TABLE = 'shootings';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Cache for resolved linked records
const shipmentIdCache = new Map<string, number>();
const shootingIdCache = new Map<string, number>();

async function fetchAirtable(endpoint: string): Promise<AirtableResponse> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function fetchAllRecords(tableId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const endpoint = offset ? `${tableId}?offset=${offset}` : tableId;
    const response = await fetchAirtable(endpoint);
    allRecords.push(...response.records);
    offset = response.offset;
    console.log(`  Fetched ${allRecords.length} records...`);
  } while (offset);

  return allRecords;
}

async function buildShipmentCache(): Promise<void> {
  console.log('Building shipment ID cache...');
  const records = await fetchAllRecords(SHIPMENTS_TABLE);

  for (const record of records) {
    const shipmentId = record.fields.shipment_id as number | undefined;
    if (shipmentId !== undefined) {
      shipmentIdCache.set(record.id, shipmentId);
    }
  }
  console.log(`  Cached ${shipmentIdCache.size} shipments`);
}

async function buildShootingCache(): Promise<void> {
  console.log('Building shooting ID cache...');
  const records = await fetchAllRecords(SHOOTINGS_TABLE);

  for (const record of records) {
    const shootingId = record.fields.shooting_id as number | undefined;
    if (shootingId !== undefined) {
      shootingIdCache.set(record.id, shootingId);
    }
  }
  console.log(`  Cached ${shootingIdCache.size} shootings`);
}

function resolveShipmentId(linkedRecordIds: string[] | undefined): number | null {
  if (!linkedRecordIds || linkedRecordIds.length === 0) return null;
  // Take first linked record
  const resolvedId = shipmentIdCache.get(linkedRecordIds[0]);
  return resolvedId ?? null;
}

function resolveShootingIds(linkedRecordIds: string[] | undefined): string | null {
  if (!linkedRecordIds || linkedRecordIds.length === 0) return null;

  const resolvedIds = linkedRecordIds
    .map(recId => shootingIdCache.get(recId))
    .filter((id): id is number => id !== undefined);

  return resolvedIds.length > 0 ? JSON.stringify(resolvedIds) : null;
}

function getFirstAttachmentUrl(attachments: unknown): string | null {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const first = attachments[0] as { url?: string };
  return first.url || null;
}

function initDatabase(db: Database.Database) {
  // Create pipeline_products table
  db.exec(`DROP TABLE IF EXISTS pipeline_products`);

  db.exec(`
    CREATE TABLE pipeline_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airtable_id TEXT UNIQUE NOT NULL,
      status TEXT,
      product_image TEXT,
      color_image TEXT,
      label_image TEXT,
      sku TEXT,
      supplier_sku TEXT,
      order_id INTEGER,
      category TEXT,
      color TEXT,
      quantity INTEGER DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      shipment_id INTEGER,
      label_text TEXT,
      warehouse_photo TEXT,
      sole_height TEXT,
      heel_height TEXT,
      upper_material TEXT,
      insole_material TEXT,
      sole_material TEXT,
      lining_material TEXT,
      notes TEXT,
      size_set TEXT,
      description TEXT,
      website_url TEXT,
      product_title TEXT,
      ready_date TEXT,
      shooting_ids TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_products_sku ON pipeline_products(sku);
    CREATE INDEX IF NOT EXISTS idx_pipeline_products_order_id ON pipeline_products(order_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_products_shipment_id ON pipeline_products(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_products_status ON pipeline_products(status);
  `);
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('Starting Airtable products import...\n');

  // Build caches for linked records first
  await buildShipmentCache();
  await buildShootingCache();

  // Fetch all products
  console.log('\nFetching products from Airtable...');
  const products = await fetchAllRecords(PRODUCTS_TABLE_ID);
  console.log(`\nFetched ${products.length} products total`);

  // Setup database
  const DATA_DIR = process.env.NODE_ENV === 'production'
    ? path.join(process.cwd(), 'data')
    : path.join(process.cwd(), '..', 'data');
  const dbPath = path.join(DATA_DIR, 'metadata.db');
  console.log(`\nDatabase: ${dbPath}`);

  const db = new Database(dbPath);
  initDatabase(db);

  // Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO pipeline_products (
      airtable_id, status, product_image, color_image, label_image,
      sku, supplier_sku, order_id, category, color, quantity,
      wholesale_price, shipment_id, label_text, warehouse_photo,
      sole_height, heel_height, upper_material, insole_material,
      sole_material, lining_material, notes, size_set, description,
      website_url, product_title, ready_date, shooting_ids
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  // Insert all products in a transaction
  const insertMany = db.transaction((records: AirtableRecord[]) => {
    for (const record of records) {
      const f = record.fields;

      insert.run(
        record.id,
        f.status as string || null,
        getFirstAttachmentUrl(f.product_image),
        getFirstAttachmentUrl(f.color_image),
        getFirstAttachmentUrl(f.label_image),
        f.sku as string || null,
        f.supplier_sku as string || null,
        parseInt(f.order_id_text as string) || null, // Use resolved order_id_text
        f.category as string || null,
        f.color as string || null,
        f.quantity as number || 0,
        f.wholesale_price as number || 0,
        resolveShipmentId(f.shipment_id as string[] | undefined),
        f.label_text as string || null,
        getFirstAttachmentUrl(f.warehouse_photo),
        f.sole_height as string || null,
        f.heel_height as string || null,
        f.upper_material as string || null,
        f.insole_material as string || null,
        f.sole_material as string || null,
        f.lining_material as string || null,
        f.notes as string || null,
        f.size_set as string || null,
        f.description as string || null,
        f.website_url as string || null,
        f.product_title as string || null,
        f.ready_date as string || null,
        resolveShootingIds(f.shooting_ids as string[] | undefined)
      );
    }
  });

  console.log('\nInserting products into database...');
  insertMany(products);
  console.log(`Inserted ${products.length} products`);

  // Print stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT order_id) as orders,
      COUNT(DISTINCT shipment_id) as shipments,
      COUNT(DISTINCT status) as statuses
    FROM pipeline_products
  `).get() as { total: number; orders: number; shipments: number; statuses: number };

  console.log('\n=== Import Summary ===');
  console.log(`Total products: ${stats.total}`);
  console.log(`Unique orders: ${stats.orders}`);
  console.log(`Unique shipments: ${stats.shipments}`);

  // Status breakdown
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM pipeline_products
    GROUP BY status
    ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  console.log('\nStatus breakdown:');
  for (const s of statusBreakdown) {
    console.log(`  ${s.status || 'null'}: ${s.count}`);
  }

  db.close();
  console.log('\nImport completed successfully!');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
