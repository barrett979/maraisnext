import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDateFilter } from '@/lib/db';
import { checkAndTriggerSync } from '@/lib/sync';

export async function GET(request: NextRequest) {
  // Check if sync is needed and trigger in background
  checkAndTriggerSync();
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;
  const campaign = searchParams.get('campaign') || '';

  const db = getDb();
  const dateFrom = getDateFilter(days);

  // Query per periodo corrente
  let sql = `
    SELECT date, campaign,
           SUM(impressions) as impressions,
           SUM(clicks) as clicks,
           SUM(cost) as cost,
           SUM(purchase) as purchase,
           SUM(addtocart) as addtocart,
           SUM(checkout) as checkout,
           AVG(CASE WHEN avg_cpc > 0 THEN avg_cpc END) as avg_cpc,
           AVG(CASE WHEN avg_position > 0 THEN avg_position END) as avg_position
    FROM campaign_daily
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (dateFrom) {
    sql += ' AND date >= ?';
    params.push(dateFrom);
  }

  if (campaign) {
    sql += ' AND campaign = ?';
    params.push(campaign);
  }

  sql += ' GROUP BY date ORDER BY date';

  const rows = db.prepare(sql).all(...params) as Array<{
    date: string;
    impressions: number;
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    avg_cpc: number;
    avg_position: number;
  }>;

  const dates: string[] = [];
  const data = {
    clicks: [] as number[],
    cost: [] as number[],
    purchase: [] as number[],
    addtocart: [] as number[],
    checkout: [] as number[],
    avg_cpc: [] as number[],
    avg_position: [] as number[],
    impressions: [] as number[],
  };

  for (const row of rows) {
    dates.push(row.date);
    data.clicks.push(row.clicks || 0);
    data.cost.push(Math.round((row.cost || 0) * 100) / 100);
    data.purchase.push(row.purchase || 0);
    data.addtocart.push(row.addtocart || 0);
    data.checkout.push(row.checkout || 0);
    data.avg_cpc.push(Math.round((row.avg_cpc || 0) * 100) / 100);
    data.avg_position.push(Math.round((row.avg_position || 0) * 100) / 100);
    data.impressions.push(row.impressions || 0);
  }

  // Calcola totali periodo precedente (solo se days < 180)
  let previousTotals = null;
  if (days && days < 180) {
    const daysNum = days;
    // Calcola date per periodo precedente
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - daysNum);
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousEnd.getDate() - daysNum + 1);

    const prevDateFrom = previousStart.toISOString().split('T')[0];
    const prevDateTo = previousEnd.toISOString().split('T')[0];

    let prevSql = `
      SELECT
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost) as cost,
        SUM(purchase) as purchase,
        SUM(addtocart) as addtocart,
        SUM(checkout) as checkout
      FROM campaign_daily
      WHERE date >= ? AND date <= ?
    `;
    const prevParams: (string | number)[] = [prevDateFrom, prevDateTo];

    if (campaign) {
      prevSql += ' AND campaign = ?';
      prevParams.push(campaign);
    }

    const prevRow = db.prepare(prevSql).get(...prevParams) as {
      impressions: number;
      clicks: number;
      cost: number;
      purchase: number;
      addtocart: number;
      checkout: number;
    } | undefined;

    if (prevRow) {
      previousTotals = {
        impressions: prevRow.impressions || 0,
        clicks: prevRow.clicks || 0,
        cost: Math.round((prevRow.cost || 0) * 100) / 100,
        purchase: prevRow.purchase || 0,
        addtocart: prevRow.addtocart || 0,
        checkout: prevRow.checkout || 0,
      };
    }
  }

  const campaigns = db.prepare(`
    SELECT DISTINCT campaign FROM campaign_daily ORDER BY campaign
  `).all() as { campaign: string }[];

  return NextResponse.json({
    dates,
    total: data,
    previousTotals,
    campaigns: campaigns.map(c => c.campaign),
  });
}
