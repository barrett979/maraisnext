/**
 * Import suppliers from Airtable into SQLite
 * Usage: npx tsx scripts/sync-airtable-suppliers.ts
 *
 * Fields: supplier_id, supplier_name, address_line, email
 */

import Database from 'better-sqlite3';
import path from 'path';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDgAaPpN2ZNh0Cx';
const SUPPLIERS_TABLE_ID = 'tblumeb4uh32c2MZZ';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

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

function initDatabase(db: Database.Database) {
  // Create pipeline_suppliers table
  db.exec(`DROP TABLE IF EXISTS pipeline_suppliers`);

  db.exec(`
    CREATE TABLE pipeline_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      airtable_id TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL,
      supplier_name TEXT,
      address_line TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_suppliers_supplier_id ON pipeline_suppliers(supplier_id);
  `);
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('Starting Airtable suppliers import...\n');

  // Fetch all suppliers
  console.log('Fetching suppliers from Airtable...');
  const suppliers = await fetchAllRecords(SUPPLIERS_TABLE_ID);
  console.log(`\nFetched ${suppliers.length} suppliers total`);

  // Show sample record to verify fields
  if (suppliers.length > 0) {
    console.log('\nSample record fields:');
    console.log(Object.keys(suppliers[0].fields));
  }

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
    INSERT INTO pipeline_suppliers (
      airtable_id, supplier_id, supplier_name, address_line, email
    ) VALUES (?, ?, ?, ?, ?)
  `);

  // Insert all suppliers in a transaction
  const insertMany = db.transaction((records: AirtableRecord[]) => {
    for (const record of records) {
      const f = record.fields;

      insert.run(
        record.id,
        f.supplier_id as number || 0,
        f.supplier_name as string || null,
        f.address_line as string || null,
        f.email as string || null
      );
    }
  });

  console.log('\nInserting suppliers into database...');
  insertMany(suppliers);
  console.log(`Inserted ${suppliers.length} suppliers`);

  // Print all suppliers
  const allSuppliers = db.prepare(`
    SELECT supplier_id, supplier_name, email
    FROM pipeline_suppliers
    ORDER BY supplier_id
  `).all() as { supplier_id: number; supplier_name: string; email: string }[];

  console.log('\n=== Suppliers ===');
  for (const s of allSuppliers) {
    console.log(`  #${s.supplier_id}: ${s.supplier_name || 'N/A'} (${s.email || 'no email'})`);
  }

  db.close();
  console.log('\nImport completed successfully!');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
