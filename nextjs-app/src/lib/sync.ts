/**
 * Sync module for Yandex Direct data import
 * Handles incremental updates without duplicates
 */

import Database from 'better-sqlite3';
import path from 'path';
import { getMetadataDb } from './db';

const DB_PATH = path.join(process.cwd(), 'data', 'data.db');
const API_URL = 'https://api.direct.yandex.com/v5/reports';

// Goal IDs
const GOALS = {
  PURCHASE: '3089610837',
  CHECKOUT: '331689893',
  ADDTOCART: '252552801',
};

const ATTRIBUTION_MODEL = 'LYDC';

// Config
const SYNC_INTERVAL_HOURS = 12; // Auto-sync after 12 hours
const REFRESH_DAYS = 7; // Always refresh last 7 days (attribution delay)

interface SyncStatus {
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string | null;
  last_sync_records: number;
  sync_in_progress: number;
}

interface ReportConfig {
  name: string;
  type: string;
  fields: string[];
  filter?: { field: string; operator: string; values: string[] };
  processingMode?: string;
}

// Get sync status
export function getSyncStatus(): SyncStatus {
  const metadataDb = getMetadataDb();
  return metadataDb.prepare('SELECT * FROM sync_status WHERE id = 1').get() as SyncStatus;
}

// Check if sync is needed
export function needsSync(): boolean {
  const status = getSyncStatus();

  // If never synced
  if (!status.last_sync_at || status.last_sync_status === 'never') {
    return true;
  }

  // If sync in progress, don't start another
  if (status.sync_in_progress) {
    return false;
  }

  // Check time since last sync
  const lastSync = new Date(status.last_sync_at);
  const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

  return hoursSinceSync >= SYNC_INTERVAL_HOURS;
}

// Set sync status
function setSyncStatus(updates: Partial<SyncStatus>) {
  const metadataDb = getMetadataDb();
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  metadataDb.prepare(`UPDATE sync_status SET ${setClause} WHERE id = 1`).run(...values);
}

// Fetch report from Yandex API
async function fetchReport(config: ReportConfig, dateFrom: string, dateTo: string): Promise<string> {
  const token = process.env.DIRECT_TOKEN;
  const clientLogin = process.env.DIRECT_CLIENT_LOGIN;

  if (!token || !clientLogin) {
    throw new Error('DIRECT_TOKEN and DIRECT_CLIENT_LOGIN environment variables are required');
  }

  const goalsXml = Object.values(GOALS).map(g => `<Goals>${g}</Goals>`).join('\n    ');
  const fieldsXml = config.fields.map(f => `<FieldNames>${f}</FieldNames>`).join('\n    ');

  let filterXml = '';
  if (config.filter) {
    const valuesXml = config.filter.values.map(v => `<Values>${v}</Values>`).join('');
    filterXml = `
      <Filter>
        <Field>${config.filter.field}</Field>
        <Operator>${config.filter.operator}</Operator>
        ${valuesXml}
      </Filter>`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ReportDefinition xmlns="http://api.direct.yandex.com/v5/reports">
  <SelectionCriteria>
    <DateFrom>${dateFrom}</DateFrom>
    <DateTo>${dateTo}</DateTo>${filterXml}
  </SelectionCriteria>
  ${goalsXml}
  <AttributionModels>${ATTRIBUTION_MODEL}</AttributionModels>
  ${fieldsXml}
  <ReportName>${config.name}_${Date.now()}</ReportName>
  <ReportType>${config.type}</ReportType>
  <DateRangeType>CUSTOM_DATE</DateRangeType>
  <Format>TSV</Format>
  <IncludeVAT>NO</IncludeVAT>
  <IncludeDiscount>NO</IncludeDiscount>
</ReportDefinition>`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Client-Login': clientLogin,
    'Accept-Language': 'en',
    'processingMode': config.processingMode || 'auto',
    'returnMoneyInMicros': 'false',
    'skipReportHeader': 'true',
    'skipReportSummary': 'true',
  };

  let retries = 0;
  const maxRetries = 60; // ~10 minutes max wait

  while (retries < maxRetries) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: xml,
    });

    if (response.status === 200) {
      return await response.text();
    } else if (response.status === 201 || response.status === 202) {
      const retryIn = parseInt(response.headers.get('retryIn') || '10');
      await new Promise(resolve => setTimeout(resolve, retryIn * 1000));
      retries++;
    } else {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }
  }

  throw new Error('Max retries exceeded');
}

function parseTSV(tsv: string): Record<string, string>[] {
  const lines = tsv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] === '--' ? '0' : values[i];
    });
    return row;
  });
}

function parseNumber(val: string | undefined): number {
  if (!val || val === '--') return 0;
  return parseFloat(val) || 0;
}

// Initialize database tables if needed
function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      campaign TEXT NOT NULL,
      ad_network_type TEXT DEFAULT 'UNKNOWN',
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      purchase INTEGER DEFAULT 0,
      addtocart INTEGER DEFAULT 0,
      checkout INTEGER DEFAULT 0,
      avg_cpc REAL DEFAULT 0,
      avg_position REAL DEFAULT 0,
      ctr REAL DEFAULT 0,
      UNIQUE(date, campaign_id, ad_network_type)
    );

    CREATE TABLE IF NOT EXISTS search_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      query TEXT NOT NULL,
      campaign TEXT NOT NULL,
      criterion TEXT,
      criteria_type TEXT,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      purchase INTEGER DEFAULT 0,
      addtocart INTEGER DEFAULT 0,
      checkout INTEGER DEFAULT 0,
      avg_cpc REAL DEFAULT 0,
      avg_click_position REAL DEFAULT 0,
      avg_impr_position REAL DEFAULT 0,
      ctr REAL DEFAULT 0,
      UNIQUE(date, campaign, query, criterion)
    );

    CREATE TABLE IF NOT EXISTS display_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      campaign TEXT NOT NULL,
      adgroup TEXT,
      placement TEXT,
      criteria TEXT,
      criteria_type TEXT,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      purchase INTEGER DEFAULT 0,
      addtocart INTEGER DEFAULT 0,
      checkout INTEGER DEFAULT 0,
      avg_cpc REAL DEFAULT 0,
      ctr REAL DEFAULT 0,
      UNIQUE(date, campaign, adgroup, placement, criteria)
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_daily_date ON campaign_daily(date);
    CREATE INDEX IF NOT EXISTS idx_campaign_daily_campaign_id ON campaign_daily(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_search_queries_date ON search_queries(date);
    CREATE INDEX IF NOT EXISTS idx_display_data_date ON display_data(date);
  `);
}

// Import campaign daily data (incremental)
async function importCampaignDaily(db: Database.Database, dateFrom: string, dateTo: string): Promise<number> {
  const config: ReportConfig = {
    name: 'CampaignDaily',
    type: 'CAMPAIGN_PERFORMANCE_REPORT',
    fields: [
      'Date', 'CampaignId', 'CampaignName', 'AdNetworkType', 'Impressions', 'Clicks', 'Cost',
      'AvgCpc', 'AvgClickPosition', 'Conversions'
    ],
  };

  const tsv = await fetchReport(config, dateFrom, dateTo);
  const rows = parseTSV(tsv);

  // Delete existing data for this date range (for refresh)
  db.prepare('DELETE FROM campaign_daily WHERE date >= ? AND date <= ?').run(dateFrom, dateTo);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO campaign_daily (date, campaign_id, campaign, ad_network_type, impressions, clicks, cost, purchase, addtocart, checkout, avg_cpc, avg_position, ctr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const purchaseKey = `Conversions_${GOALS.PURCHASE}_${ATTRIBUTION_MODEL}`;
  const addtocartKey = `Conversions_${GOALS.ADDTOCART}_${ATTRIBUTION_MODEL}`;
  const checkoutKey = `Conversions_${GOALS.CHECKOUT}_${ATTRIBUTION_MODEL}`;

  const insertMany = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const impressions = parseNumber(row.Impressions);
      const clicks = parseNumber(row.Clicks);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      insert.run(
        row.Date,
        row.CampaignId,
        row.CampaignName,
        row.AdNetworkType || 'UNKNOWN',
        impressions,
        clicks,
        parseNumber(row.Cost),
        parseNumber(row[purchaseKey]),
        parseNumber(row[addtocartKey]),
        parseNumber(row[checkoutKey]),
        parseNumber(row.AvgCpc),
        parseNumber(row.AvgClickPosition),
        ctr
      );
    }
  });

  insertMany(rows);
  return rows.length;
}

// Import search queries (incremental)
async function importSearchQueries(db: Database.Database, dateFrom: string, dateTo: string): Promise<number> {
  const config: ReportConfig = {
    name: 'SearchQueries',
    type: 'SEARCH_QUERY_PERFORMANCE_REPORT',
    fields: [
      'Date', 'Query', 'CampaignName', 'Criterion', 'CriteriaType',
      'Impressions', 'Clicks', 'Cost', 'AvgCpc', 'AvgClickPosition',
      'AvgImpressionPosition', 'Conversions'
    ],
    processingMode: 'offline',
  };

  const tsv = await fetchReport(config, dateFrom, dateTo);
  const rows = parseTSV(tsv);

  // Delete existing data for this date range (for refresh)
  db.prepare('DELETE FROM search_queries WHERE date >= ? AND date <= ?').run(dateFrom, dateTo);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO search_queries (date, query, campaign, criterion, criteria_type, impressions, clicks, cost, purchase, addtocart, checkout, avg_cpc, avg_click_position, avg_impr_position, ctr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const purchaseKey = `Conversions_${GOALS.PURCHASE}_${ATTRIBUTION_MODEL}`;
  const addtocartKey = `Conversions_${GOALS.ADDTOCART}_${ATTRIBUTION_MODEL}`;
  const checkoutKey = `Conversions_${GOALS.CHECKOUT}_${ATTRIBUTION_MODEL}`;

  const insertMany = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const impressions = parseNumber(row.Impressions);
      const clicks = parseNumber(row.Clicks);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      insert.run(
        row.Date,
        row.Query,
        row.CampaignName,
        row.Criterion,
        row.CriteriaType,
        impressions,
        clicks,
        parseNumber(row.Cost),
        parseNumber(row[purchaseKey]),
        parseNumber(row[addtocartKey]),
        parseNumber(row[checkoutKey]),
        parseNumber(row.AvgCpc),
        parseNumber(row.AvgClickPosition),
        parseNumber(row.AvgImpressionPosition),
        ctr
      );
    }
  });

  insertMany(rows);
  return rows.length;
}

// Import display data (incremental)
async function importDisplayData(db: Database.Database, dateFrom: string, dateTo: string): Promise<number> {
  const config: ReportConfig = {
    name: 'DisplayData',
    type: 'CRITERIA_PERFORMANCE_REPORT',
    fields: [
      'Date', 'CampaignName', 'AdGroupName', 'Placement', 'Criteria', 'CriteriaType',
      'Impressions', 'Clicks', 'Cost', 'AvgCpc', 'Conversions'
    ],
    filter: {
      field: 'AdNetworkType',
      operator: 'EQUALS',
      values: ['AD_NETWORK'],
    },
  };

  const tsv = await fetchReport(config, dateFrom, dateTo);
  const rows = parseTSV(tsv);

  // Delete existing data for this date range (for refresh)
  db.prepare('DELETE FROM display_data WHERE date >= ? AND date <= ?').run(dateFrom, dateTo);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO display_data (date, placement, campaign, adgroup, criteria, criteria_type, impressions, clicks, cost, purchase, addtocart, checkout, avg_cpc, ctr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const purchaseKey = `Conversions_${GOALS.PURCHASE}_${ATTRIBUTION_MODEL}`;
  const addtocartKey = `Conversions_${GOALS.ADDTOCART}_${ATTRIBUTION_MODEL}`;
  const checkoutKey = `Conversions_${GOALS.CHECKOUT}_${ATTRIBUTION_MODEL}`;

  const insertMany = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const impressions = parseNumber(row.Impressions);
      const clicks = parseNumber(row.Clicks);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      insert.run(
        row.Date,
        row.Placement || '',
        row.CampaignName,
        row.AdGroupName,
        row.Criteria,
        row.CriteriaType,
        impressions,
        clicks,
        parseNumber(row.Cost),
        parseNumber(row[purchaseKey]),
        parseNumber(row[addtocartKey]),
        parseNumber(row[checkoutKey]),
        parseNumber(row.AvgCpc),
        ctr
      );
    }
  });

  insertMany(rows);
  return rows.length;
}

// Calculate date range for sync
function calculateDateRange(): { dateFrom: string; dateTo: string; displayDateFrom: string } {
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() - 1); // Yesterday (today's data not complete)
  const dateToStr = dateTo.toISOString().split('T')[0];

  // Always refresh last REFRESH_DAYS days
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - REFRESH_DAYS);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  // Display uses shorter range
  const displayDateFrom = new Date(dateTo);
  displayDateFrom.setDate(displayDateFrom.getDate() - Math.min(REFRESH_DAYS, 7));
  const displayDateFromStr = displayDateFrom.toISOString().split('T')[0];

  return {
    dateFrom: dateFromStr,
    dateTo: dateToStr,
    displayDateFrom: displayDateFromStr,
  };
}

// Main sync function
export async function runSync(): Promise<{ success: boolean; records: number; error?: string }> {
  const status = getSyncStatus();

  // Check if already syncing
  if (status.sync_in_progress) {
    return { success: false, records: 0, error: 'Sync already in progress' };
  }

  // Mark as syncing
  setSyncStatus({ sync_in_progress: 1, last_sync_status: 'running' });

  const db = new Database(DB_PATH);
  let totalRecords = 0;

  try {
    // Ensure tables exist
    ensureTables(db);

    const { dateFrom, dateTo, displayDateFrom } = calculateDateRange();
    console.log(`[Sync] Syncing data from ${dateFrom} to ${dateTo}`);

    // Import all data types
    const campaignRecords = await importCampaignDaily(db, dateFrom, dateTo);
    console.log(`[Sync] Imported ${campaignRecords} campaign records`);
    totalRecords += campaignRecords;

    const searchRecords = await importSearchQueries(db, dateFrom, dateTo);
    console.log(`[Sync] Imported ${searchRecords} search records`);
    totalRecords += searchRecords;

    const displayRecords = await importDisplayData(db, displayDateFrom, dateTo);
    console.log(`[Sync] Imported ${displayRecords} display records`);
    totalRecords += displayRecords;

    // Update status
    setSyncStatus({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'completed',
      last_sync_error: null,
      last_sync_records: totalRecords,
      sync_in_progress: 0,
    });

    console.log(`[Sync] Completed successfully. Total records: ${totalRecords}`);
    return { success: true, records: totalRecords };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Sync] Failed:`, errorMessage);

    setSyncStatus({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'failed',
      last_sync_error: errorMessage,
      sync_in_progress: 0,
    });

    return { success: false, records: totalRecords, error: errorMessage };

  } finally {
    db.close();
  }
}

// Trigger sync in background (non-blocking)
let syncPromise: Promise<{ success: boolean; records: number; error?: string }> | null = null;

export function triggerBackgroundSync(): void {
  if (syncPromise) {
    console.log('[Sync] Background sync already running, skipping');
    return;
  }

  console.log('[Sync] Starting background sync');
  syncPromise = runSync().finally(() => {
    syncPromise = null;
  });
}

// Check and trigger sync if needed (call from API routes)
export function checkAndTriggerSync(): void {
  if (needsSync()) {
    triggerBackgroundSync();
  }
}
