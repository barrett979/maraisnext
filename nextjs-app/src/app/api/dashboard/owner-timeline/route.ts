import { NextRequest, NextResponse } from 'next/server';
import { getDb, getMetadataDb, getDateFilter } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;

  const db = getDb();
  const metadataDb = getMetadataDb();
  const dateFrom = getDateFilter(days);

  // Ottieni tutte le campagne con owner assegnato (usando campaign_id)
  const ownedCampaigns = metadataDb.prepare(`
    SELECT campaign_id, owner FROM campaign_metadata WHERE owner IS NOT NULL
  `).all() as Array<{ campaign_id: string; owner: string }>;

  // Crea set di campaign_id owned per lookup veloce
  const ownedSet = new Set(ownedCampaigns.map(c => c.campaign_id));

  // Query per dati giornalieri di tutte le campagne (usando campaign_id)
  let sql = `
    SELECT date, campaign_id,
           SUM(purchase) as purchase,
           SUM(cost) as cost
    FROM campaign_daily
    WHERE 1=1
  `;
  const params: string[] = [];

  if (dateFrom) {
    sql += ' AND date >= ?';
    params.push(dateFrom);
  }

  sql += ' GROUP BY date, campaign_id ORDER BY date';

  const rows = db.prepare(sql).all(...params) as Array<{
    date: string;
    campaign_id: string;
    purchase: number;
    cost: number;
  }>;

  // Raggruppa per data e calcola owned vs unowned (purchase e cost)
  const dateMap = new Map<string, {
    ownedPurchase: number;
    unownedPurchase: number;
    ownedCost: number;
    unownedCost: number;
  }>();

  for (const row of rows) {
    if (!dateMap.has(row.date)) {
      dateMap.set(row.date, {
        ownedPurchase: 0,
        unownedPurchase: 0,
        ownedCost: 0,
        unownedCost: 0
      });
    }
    const entry = dateMap.get(row.date)!;
    if (ownedSet.has(row.campaign_id)) {
      entry.ownedPurchase += row.purchase || 0;
      entry.ownedCost += row.cost || 0;
    } else {
      entry.unownedPurchase += row.purchase || 0;
      entry.unownedCost += row.cost || 0;
    }
  }

  // Converti in array ordinato
  const timeline = Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      date,
      ownedPurchase: values.ownedPurchase,
      unownedPurchase: values.unownedPurchase,
      ownedCost: Math.round(values.ownedCost),
      unownedCost: Math.round(values.unownedCost),
    }));

  // Ottieni lista owners con colori
  const owners = metadataDb.prepare(`
    SELECT id, name, color FROM owners ORDER BY name
  `).all() as Array<{ id: number; name: string; color: string | null }>;

  return NextResponse.json({
    timeline,
    owners,
    ownedCampaignsCount: ownedSet.size,
  });
}
