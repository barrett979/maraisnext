import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDateFilter } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;

  const db = getDb();
  const dateFrom = getDateFilter(days);

  // Query per CPC e CPA giornalieri (aggregati per data)
  let cpcCpaSql = `
    SELECT date,
           SUM(clicks) as clicks,
           SUM(cost) as cost,
           SUM(purchase) as purchase
    FROM campaign_daily
    WHERE 1=1
  `;
  const params: string[] = [];

  if (dateFrom) {
    cpcCpaSql += ' AND date >= ?';
    params.push(dateFrom);
  }

  cpcCpaSql += ' GROUP BY date ORDER BY date';

  const cpcCpaRows = db.prepare(cpcCpaSql).all(...params) as Array<{
    date: string;
    clicks: number;
    cost: number;
    purchase: number;
  }>;

  // Calcola CPC e CPA per ogni giorno
  const cpcCpaTimeline = cpcCpaRows.map(row => ({
    date: row.date,
    cpc: row.clicks > 0 ? Math.round((row.cost / row.clicks) * 100) / 100 : 0,
    cpa: row.purchase > 0 ? Math.round(row.cost / row.purchase) : 0,
  }));

  // Query per distribuzione budget per AdNetworkType
  let budgetSql = `
    SELECT date, ad_network_type,
           SUM(cost) as cost
    FROM campaign_daily
    WHERE 1=1
  `;
  const budgetParams: string[] = [];

  if (dateFrom) {
    budgetSql += ' AND date >= ?';
    budgetParams.push(dateFrom);
  }

  budgetSql += ' GROUP BY date, ad_network_type ORDER BY date';

  const budgetRows = db.prepare(budgetSql).all(...budgetParams) as Array<{
    date: string;
    ad_network_type: string;
    cost: number;
  }>;

  // Raggruppa per data
  const budgetMap = new Map<string, { search: number; yan: number; other: number }>();

  for (const row of budgetRows) {
    if (!budgetMap.has(row.date)) {
      budgetMap.set(row.date, { search: 0, yan: 0, other: 0 });
    }
    const entry = budgetMap.get(row.date)!;

    if (row.ad_network_type === 'SEARCH') {
      entry.search += row.cost || 0;
    } else if (row.ad_network_type === 'AD_NETWORK') {
      entry.yan += row.cost || 0;
    } else {
      entry.other += row.cost || 0;
    }
  }

  // Converti in array
  const budgetTimeline = Array.from(budgetMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      search: Math.round(values.search),
      yan: Math.round(values.yan),
      other: Math.round(values.other),
    }));

  return NextResponse.json({
    cpcCpaTimeline,
    budgetTimeline,
  });
}
