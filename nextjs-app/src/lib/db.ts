import Database from 'better-sqlite3';
import path from 'path';

// In dev: process.cwd() = nextjs-app/, data is in ../data/
// In prod (Docker): process.cwd() = /app/, data is in /app/data/
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? path.join(process.cwd(), 'data')
  : path.join(process.cwd(), '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'data.db');
const METADATA_DB_PATH = path.join(DATA_DIR, 'metadata.db');

let db: Database.Database | null = null;
let metadataDb: Database.Database | null = null;

export function getDb(writable = false): Database.Database {
  if (writable) {
    // Per scrittura, crea una nuova connessione
    return new Database(DB_PATH);
  }
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

export function getMetadataDb(): Database.Database {
  if (!metadataDb) {
    metadataDb = new Database(METADATA_DB_PATH);
    // Crea tabella campaign_metadata con campaign_id come chiave primaria
    // Manteniamo anche campaign_name per visualizzazione (può essere aggiornato)
    metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS campaign_metadata (
        campaign_id TEXT PRIMARY KEY,
        campaign_name TEXT,
        owner TEXT,
        tags TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Crea tabella sync_status per tracciare stato sincronizzazione
    metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync_at TEXT,
        last_sync_status TEXT DEFAULT 'idle',
        last_sync_error TEXT,
        last_sync_records INTEGER DEFAULT 0,
        sync_in_progress INTEGER DEFAULT 0
      )
    `);
    // Inserisci riga iniziale se non esiste
    metadataDb.exec(`
      INSERT OR IGNORE INTO sync_status (id, last_sync_status) VALUES (1, 'never')
    `);
    // Migra vecchi dati se esiste colonna campaign invece di campaign_id
    try {
      const hasOldColumn = metadataDb.prepare("PRAGMA table_info(campaign_metadata)").all() as Array<{name: string}>;
      const columnNames = hasOldColumn.map(c => c.name);
      if (columnNames.includes('campaign') && !columnNames.includes('campaign_id')) {
        // Vecchio schema - rinomina tabella e crea nuova
        metadataDb.exec(`ALTER TABLE campaign_metadata RENAME TO campaign_metadata_old`);
        metadataDb.exec(`
          CREATE TABLE campaign_metadata (
            campaign_id TEXT PRIMARY KEY,
            campaign_name TEXT,
            owner TEXT,
            tags TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // I vecchi dati verranno persi perché non avevamo campaign_id
        metadataDb.exec(`DROP TABLE campaign_metadata_old`);
      }
    } catch {
      // Ignora errori di migrazione
    }
    // Crea tabella owners per lista dipendenti
    metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS owners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Inserisci owner di default se tabella vuota
    const count = metadataDb.prepare('SELECT COUNT(*) as cnt FROM owners').get() as { cnt: number };
    if (count.cnt === 0) {
      metadataDb.prepare('INSERT INTO owners (name, color) VALUES (?, ?)').run('Vadim', '#3b82f6');
    }
    // Crea tabella users per autenticazione
    metadataDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'user',
        language TEXT DEFAULT 'ru',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Migra: aggiungi colonna language se non esiste
    try {
      const userColumns = metadataDb.prepare("PRAGMA table_info(users)").all() as Array<{name: string}>;
      const userColumnNames = userColumns.map(c => c.name);
      if (!userColumnNames.includes('language')) {
        metadataDb.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'ru'`);
      }
    } catch {
      // Ignora errori di migrazione
    }
  }
  return metadataDb;
}

export function getDateFilter(days: number | null): string | null {
  if (!days || days <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export type AdNetworkType = 'SEARCH' | 'AD_NETWORK' | 'UNKNOWN';

export interface CampaignDaily {
  date: string;
  campaign_id: string;
  campaign: string;
  ad_network_type: AdNetworkType;
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  avg_cpc: number;
  avg_position: number;
}

export interface SearchQuery {
  query: string;
  campaign: string;
  criterion: string;
  criteria_type: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  avg_cpc: number;
  avg_position: number;
  avg_impr_position: number;
  ctr: number;
  cpa: number;
  cr: number;
}

export interface DisplayData {
  placement?: string;
  campaign?: string;
  adgroup?: string;
  criteria?: string;
  criteria_type?: string;
  campaigns?: string[];
  impressions: number;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  cpa: number;
  cr: number;
  ctr: number;
}
