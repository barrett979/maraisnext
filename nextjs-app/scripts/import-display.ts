/**
 * Import only display/YAN data from Yandex Direct API
 * Usage: npx tsx scripts/import-display.ts [days]
 */

import Database from 'better-sqlite3';
import path from 'path';

const DIRECT_TOKEN = process.env.DIRECT_TOKEN;
const DIRECT_CLIENT_LOGIN = process.env.DIRECT_CLIENT_LOGIN;
const API_URL = 'https://api.direct.yandex.com/v5/reports';

const GOALS = {
  PURCHASE: '3089610837',
  CHECKOUT: '331689893',
  ADDTOCART: '252552801',
};

const ATTRIBUTION_MODEL = 'LYDC';

interface ReportConfig {
  name: string;
  type: string;
  fields: string[];
  filter?: { field: string; operator: string; values: string[] };
  processingMode?: string;
}

async function fetchReport(config: ReportConfig, dateFrom: string, dateTo: string): Promise<string> {
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
    'Authorization': `Bearer ${DIRECT_TOKEN}`,
    'Client-Login': DIRECT_CLIENT_LOGIN!,
    'Accept-Language': 'en',
    'processingMode': config.processingMode || 'auto',
    'returnMoneyInMicros': 'false',
    'skipReportHeader': 'true',
    'skipReportSummary': 'true',
  };

  let retries = 0;
  const maxRetries = 300; // ~50 minutes max wait

  while (retries < maxRetries) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: xml,
    });

    if (response.status === 200) {
      return await response.text();
    } else if (response.status === 201 || response.status === 202) {
      const retryIn = parseInt(response.headers.get('retryIn') || '5');
      console.log(`  Report in queue, waiting ${retryIn}s... (retry ${retries + 1}/${maxRetries})`);
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

async function importDisplayData(db: Database.Database, dateFrom: string, dateTo: string) {
  console.log('Importing display/YAN data...');

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
  console.log(`  Fetched ${rows.length} rows`);

  // Clear old data
  db.exec('DELETE FROM display_data');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO display_data (date, placement, campaign, adgroup, criteria, criteria_type, impressions, clicks, cost, purchase, addtocart, checkout, avg_cpc, ctr)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const purchaseKey = `Conversions_${GOALS.PURCHASE}_${ATTRIBUTION_MODEL}`;
  const addtocartKey = `Conversions_${GOALS.ADDTOCART}_${ATTRIBUTION_MODEL}`;
  const checkoutKey = `Conversions_${GOALS.CHECKOUT}_${ATTRIBUTION_MODEL}`;

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

  console.log(`  Inserted ${rows.length} rows`);
}

async function main() {
  if (!DIRECT_TOKEN || !DIRECT_CLIENT_LOGIN) {
    console.error('Error: DIRECT_TOKEN and DIRECT_CLIENT_LOGIN environment variables are required');
    process.exit(1);
  }

  const days = parseInt(process.argv[2] || '180');
  console.log(`Importing last ${days} days of display/YAN data...`);

  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log(`Date range: ${dateFrom} to ${dateTo}`);

  const dbPath = path.join(process.cwd(), 'data.db');
  console.log(`Database: ${dbPath}`);

  const db = new Database(dbPath);

  try {
    await importDisplayData(db, dateFrom, dateTo);

    console.log('\nImport completed successfully!');

    // Print stats
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM display_data) as display_rows,
        (SELECT MIN(date) FROM display_data) as min_date,
        (SELECT MAX(date) FROM display_data) as max_date
    `).get() as any;

    console.log(`\nDatabase stats:`);
    console.log(`  Display data: ${stats.display_rows} rows`);
    console.log(`  Date range: ${stats.min_date} to ${stats.max_date}`);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
