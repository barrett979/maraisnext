/**
 * Import orders from Airtable into SQLite
 * Usage: npx tsx scripts/sync-airtable-orders.ts
 *
 * This script:
 * 1. Fetches all orders from Airtable
 * 2. Resolves supplier_id linked records to get actual supplier IDs
 * 3. Stores in pipeline_orders SQLite table
 */

import Database from 'better-sqlite3';
import path from 'path';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDgAaPpN2ZNh0Cx';
const ORDERS_TABLE_ID = 'tbl0q2H0C2Q4QMUne';
const SUPPLIERS_TABLE = 'suppliers';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface Attachment {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

// Cache for resolved supplier IDs
const supplierIdCache = new Map<string, number>();

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

async function buildSupplierCache(): Promise<void> {
  console.log('Building supplier ID cache...');
  const records = await fetchAllRecords(SUPPLIERS_TABLE);

  for (const record of records) {
    const supplierId = record.fields.supplier_id as number | undefined;
    if (supplierId !== undefined) {
      supplierIdCache.set(record.id, supplierId);
    }
  }
  console.log(`  Cached ${supplierIdCache.size} suppliers`);
}

function resolveSupplierId(linkedRecordIds: string[] | undefined): number | null {
  if (!linkedRecordIds || linkedRecordIds.length === 0) return null;
  // Take first linked record
  const resolvedId = supplierIdCache.get(linkedRecordIds[0]);
  return resolvedId ?? null;
}

function extractInvoiceFilenames(attachments: unknown): string | null {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  const filenames = attachments
    .map((att: Attachment) => att.filename)
    .filter(Boolean);

  return filenames.length > 0 ? JSON.stringify(filenames) : null;
}

function initDatabase(db: Database.Database) {
  // Create pipeline_orders table
  db.exec(`DROP TABLE IF EXISTS pipeline_orders`);

  db.exec(`
    CREATE TABLE pipeline_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airtable_id TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      order_date TEXT,
      supplier_id INTEGER,
      brand TEXT,
      season TEXT,
      status TEXT,
      expected_delivery TEXT,
      invoices TEXT,
      gender TEXT,
      country TEXT,
      product TEXT,
      notes TEXT,
      archived INTEGER DEFAULT 0,
      discount_percent TEXT,
      storno TEXT,
      task_proforma INTEGER DEFAULT 0,
      task_acconto INTEGER DEFAULT 0,
      task_fullfilled INTEGER DEFAULT 0,
      task_saldo INTEGER DEFAULT 0,
      task_ritirato INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_orders_order_id ON pipeline_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_orders_supplier_id ON pipeline_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_orders_status ON pipeline_orders(status);
    CREATE INDEX IF NOT EXISTS idx_pipeline_orders_season ON pipeline_orders(season);
  `);
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('Starting Airtable orders import...\n');

  // Build cache for suppliers
  await buildSupplierCache();

  // Fetch all orders
  console.log('\nFetching orders from Airtable...');
  const orders = await fetchAllRecords(ORDERS_TABLE_ID);
  console.log(`\nFetched ${orders.length} orders total`);

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
    INSERT INTO pipeline_orders (
      airtable_id, order_id, order_date, supplier_id, brand, season,
      status, expected_delivery, invoices, gender, country, product,
      notes, archived, discount_percent, storno,
      task_proforma, task_acconto, task_fullfilled, task_saldo, task_ritirato
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  // Insert all orders in a transaction
  const insertMany = db.transaction((records: AirtableRecord[]) => {
    for (const record of records) {
      const f = record.fields;

      insert.run(
        record.id,
        f.order_id as number || 0,
        f.order_date as string || null,
        resolveSupplierId(f.supplier_id as string[] | undefined),
        f.brand as string || null,
        f.season as string || null,
        f.status as string || null,
        f.expected_delivery as string || null,
        extractInvoiceFilenames(f.invoices),
        f.gender as string || null,
        f.country as string || null,
        f.product as string || null,
        f.notes as string || null,
        f.archived ? 1 : 0,
        f.discount_percent as string || null,
        f.storno as string || null,
        f.proforma ? 1 : 0,
        f.acconto ? 1 : 0,
        f.fullfilled ? 1 : 0,
        f.saldo ? 1 : 0,
        f.ritirato ? 1 : 0
      );
    }
  });

  console.log('\nInserting orders into database...');
  insertMany(orders);
  console.log(`Inserted ${orders.length} orders`);

  // Print stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT supplier_id) as suppliers,
      COUNT(DISTINCT season) as seasons,
      COUNT(DISTINCT status) as statuses,
      SUM(archived) as archived_count
    FROM pipeline_orders
  `).get() as { total: number; suppliers: number; seasons: number; statuses: number; archived_count: number };

  console.log('\n=== Import Summary ===');
  console.log(`Total orders: ${stats.total}`);
  console.log(`Unique suppliers: ${stats.suppliers}`);
  console.log(`Unique seasons: ${stats.seasons}`);
  console.log(`Archived: ${stats.archived_count}`);

  // Status breakdown
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM pipeline_orders
    GROUP BY status
    ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  console.log('\nStatus breakdown:');
  for (const s of statusBreakdown) {
    console.log(`  ${s.status || 'null'}: ${s.count}`);
  }

  // Season breakdown
  const seasonBreakdown = db.prepare(`
    SELECT season, COUNT(*) as count
    FROM pipeline_orders
    GROUP BY season
    ORDER BY season DESC
  `).all() as { season: string; count: number }[];

  console.log('\nSeason breakdown:');
  for (const s of seasonBreakdown) {
    console.log(`  ${s.season || 'null'}: ${s.count}`);
  }

  db.close();
  console.log('\nImport completed successfully!');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
