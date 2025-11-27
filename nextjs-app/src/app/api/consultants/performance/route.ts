import { NextRequest, NextResponse } from 'next/server';
import { getDb, getMetadataDb, getDateFilter } from '@/lib/db';

interface PerformanceMetrics {
  cost: number;
  clicks: number;
  impressions: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  cpa: number;
  cr: number;
  ctr: number;
  avgPosition: number;
  avgCpc: number;
  funnelEfficiency: number; // checkout → purchase conversion
  campaignsCount: number;
}

interface TimelinePoint {
  date: string;
  cost: number;
  purchase: number;
  cpa: number;
  cr: number;
}

interface ConsultantData {
  name: string;
  color: string;
  startDate: string | null; // Data della prima campagna
  current: PerformanceMetrics;
  previous: PerformanceMetrics | null;
  timeline: TimelinePoint[];
  campaigns: Array<{
    campaign_id: string;
    campaign: string;
    cost: number;
    purchase: number;
    cpa: number;
    cr: number;
  }>;
}

function calculateMetrics(rows: Array<{
  cost: number;
  clicks: number;
  impressions: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  avg_cpc: number;
  avg_position: number;
}>, campaignsCount: number): PerformanceMetrics {
  const totals = rows.reduce((acc, row) => ({
    cost: acc.cost + (row.cost || 0),
    clicks: acc.clicks + (row.clicks || 0),
    impressions: acc.impressions + (row.impressions || 0),
    purchase: acc.purchase + (row.purchase || 0),
    addtocart: acc.addtocart + (row.addtocart || 0),
    checkout: acc.checkout + (row.checkout || 0),
    avgCpcSum: acc.avgCpcSum + (row.avg_cpc || 0),
    avgPosSum: acc.avgPosSum + (row.avg_position || 0),
    count: acc.count + 1,
  }), { cost: 0, clicks: 0, impressions: 0, purchase: 0, addtocart: 0, checkout: 0, avgCpcSum: 0, avgPosSum: 0, count: 0 });

  return {
    cost: Math.round(totals.cost),
    clicks: totals.clicks,
    impressions: totals.impressions,
    purchase: totals.purchase,
    addtocart: totals.addtocart,
    checkout: totals.checkout,
    cpa: totals.purchase > 0 ? Math.round(totals.cost / totals.purchase) : 0,
    cr: totals.clicks > 0 ? Math.round((totals.purchase / totals.clicks) * 10000) / 100 : 0,
    ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0,
    avgPosition: totals.count > 0 ? Math.round((totals.avgPosSum / totals.count) * 10) / 10 : 0,
    avgCpc: totals.count > 0 ? Math.round(totals.avgCpcSum / totals.count) : 0,
    funnelEfficiency: totals.checkout > 0 ? Math.round((totals.purchase / totals.checkout) * 10000) / 100 : 0,
    campaignsCount,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30;
  const consultantFilter = searchParams.get('consultant') || null;

  const db = getDb();
  const metadataDb = getMetadataDb();

  // Calcola date per periodo corrente e precedente
  const now = new Date();
  const currentEnd = now.toISOString().split('T')[0];
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - days);
  const currentStartStr = currentStart.toISOString().split('T')[0];

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - days + 1);
  const previousEndStr = previousEnd.toISOString().split('T')[0];
  const previousStartStr = previousStart.toISOString().split('T')[0];

  // Ottieni tutti i consulenti
  const owners = metadataDb.prepare(`
    SELECT id, name, color FROM owners ORDER BY name
  `).all() as Array<{ id: number; name: string; color: string | null }>;

  // Ottieni mapping campagne → owner
  const campaignOwners = metadataDb.prepare(`
    SELECT campaign_id, owner FROM campaign_metadata WHERE owner IS NOT NULL
  `).all() as Array<{ campaign_id: string; owner: string }>;

  const ownerCampaignMap = new Map<string, Set<string>>();
  for (const co of campaignOwners) {
    if (!ownerCampaignMap.has(co.owner)) {
      ownerCampaignMap.set(co.owner, new Set());
    }
    ownerCampaignMap.get(co.owner)!.add(co.campaign_id);
  }

  // Set di tutte le campagne taggabili
  const allOwnedCampaignIds = new Set(campaignOwners.map(c => c.campaign_id));

  // Funzione per ottenere la data della prima campagna per un set di campaign_ids
  const getFirstCampaignDate = (campaignIds: Set<string> | null, isUnowned = false): string | null => {
    let sql = `SELECT MIN(date) as first_date FROM campaign_daily WHERE 1=1`;
    const params: string[] = [];

    if (campaignIds && campaignIds.size > 0) {
      sql += ` AND campaign_id IN (${Array.from(campaignIds).map(() => '?').join(',')})`;
      params.push(...Array.from(campaignIds));
    } else if (isUnowned && allOwnedCampaignIds.size > 0) {
      sql += ` AND campaign_id NOT IN (${Array.from(allOwnedCampaignIds).map(() => '?').join(',')})`;
      params.push(...Array.from(allOwnedCampaignIds));
    }

    const result = db.prepare(sql).get(...params) as { first_date: string | null } | undefined;
    return result?.first_date || null;
  };

  // Funzione per ottenere dati per un set di campaign_ids
  const getDataForCampaigns = (campaignIds: Set<string> | null, dateFrom: string, dateTo: string, isUnowned = false) => {
    let sql = `
      SELECT date, campaign_id, campaign, cost, clicks, impressions, purchase, addtocart, checkout, avg_cpc, avg_position
      FROM campaign_daily
      WHERE date >= ? AND date <= ?
    `;
    const params: (string | number)[] = [dateFrom, dateTo];

    if (campaignIds && campaignIds.size > 0) {
      sql += ` AND campaign_id IN (${Array.from(campaignIds).map(() => '?').join(',')})`;
      params.push(...Array.from(campaignIds));
    } else if (isUnowned) {
      // Per Marais: tutte le campagne NON taggabili
      if (allOwnedCampaignIds.size > 0) {
        sql += ` AND campaign_id NOT IN (${Array.from(allOwnedCampaignIds).map(() => '?').join(',')})`;
        params.push(...Array.from(allOwnedCampaignIds));
      }
    }

    return db.prepare(sql).all(...params) as Array<{
      date: string;
      campaign_id: string;
      campaign: string;
      cost: number;
      clicks: number;
      impressions: number;
      purchase: number;
      addtocart: number;
      checkout: number;
      avg_cpc: number;
      avg_position: number;
    }>;
  };

  // Prepara dati per ogni consulente
  const consultantsData: ConsultantData[] = [];

  // Aggiungi "Marais" come baseline (campagne non taggabili)
  const maraisCurrentData = getDataForCampaigns(null, currentStartStr, currentEnd, true);
  const maraisPreviousData = getDataForCampaigns(null, previousStartStr, previousEndStr, true);
  const maraisStartDate = getFirstCampaignDate(null, true);

  // Conta campagne uniche Marais
  const maraisCampaignIds = new Set(maraisCurrentData.map(r => r.campaign_id));

  // Timeline Marais
  const maraisTimelineMap = new Map<string, { cost: number; clicks: number; purchase: number }>();
  for (const row of maraisCurrentData) {
    if (!maraisTimelineMap.has(row.date)) {
      maraisTimelineMap.set(row.date, { cost: 0, clicks: 0, purchase: 0 });
    }
    const entry = maraisTimelineMap.get(row.date)!;
    entry.cost += row.cost || 0;
    entry.clicks += row.clicks || 0;
    entry.purchase += row.purchase || 0;
  }

  // Campagne dettaglio Marais
  const maraisCampaignsMap = new Map<string, { campaign: string; cost: number; clicks: number; purchase: number }>();
  for (const row of maraisCurrentData) {
    if (!maraisCampaignsMap.has(row.campaign_id)) {
      maraisCampaignsMap.set(row.campaign_id, { campaign: row.campaign, cost: 0, clicks: 0, purchase: 0 });
    }
    const entry = maraisCampaignsMap.get(row.campaign_id)!;
    entry.cost += row.cost || 0;
    entry.clicks += row.clicks || 0;
    entry.purchase += row.purchase || 0;
  }

  consultantsData.push({
    name: 'Marais',
    color: '#f97316',
    startDate: maraisStartDate,
    current: calculateMetrics(maraisCurrentData, maraisCampaignIds.size),
    previous: maraisPreviousData.length > 0 ? calculateMetrics(maraisPreviousData, maraisCampaignIds.size) : null,
    timeline: Array.from(maraisTimelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        cost: Math.round(data.cost),
        purchase: data.purchase,
        cpa: data.purchase > 0 ? Math.round(data.cost / data.purchase) : 0,
        cr: data.clicks > 0 ? Math.round((data.purchase / data.clicks) * 10000) / 100 : 0,
      })),
    campaigns: Array.from(maraisCampaignsMap.entries())
      .map(([campaign_id, data]) => ({
        campaign_id,
        campaign: data.campaign,
        cost: Math.round(data.cost),
        purchase: data.purchase,
        cpa: data.purchase > 0 ? Math.round(data.cost / data.purchase) : 0,
        cr: data.clicks > 0 ? Math.round((data.purchase / data.clicks) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost),
  });

  // Dati per ogni consulente
  for (const owner of owners) {
    const campaignIds = ownerCampaignMap.get(owner.name);
    if (!campaignIds || campaignIds.size === 0) {
      // Consulente senza campagne assegnate
      consultantsData.push({
        name: owner.name,
        color: owner.color || '#3b82f6',
        startDate: null,
        current: calculateMetrics([], 0),
        previous: null,
        timeline: [],
        campaigns: [],
      });
      continue;
    }

    const currentData = getDataForCampaigns(campaignIds, currentStartStr, currentEnd);
    const previousData = getDataForCampaigns(campaignIds, previousStartStr, previousEndStr);
    const consultantStartDate = getFirstCampaignDate(campaignIds);

    // Timeline
    const timelineMap = new Map<string, { cost: number; clicks: number; purchase: number }>();
    for (const row of currentData) {
      if (!timelineMap.has(row.date)) {
        timelineMap.set(row.date, { cost: 0, clicks: 0, purchase: 0 });
      }
      const entry = timelineMap.get(row.date)!;
      entry.cost += row.cost || 0;
      entry.clicks += row.clicks || 0;
      entry.purchase += row.purchase || 0;
    }

    // Campagne dettaglio
    const campaignsMap = new Map<string, { campaign: string; cost: number; clicks: number; purchase: number }>();
    for (const row of currentData) {
      if (!campaignsMap.has(row.campaign_id)) {
        campaignsMap.set(row.campaign_id, { campaign: row.campaign, cost: 0, clicks: 0, purchase: 0 });
      }
      const entry = campaignsMap.get(row.campaign_id)!;
      entry.cost += row.cost || 0;
      entry.clicks += row.clicks || 0;
      entry.purchase += row.purchase || 0;
    }

    consultantsData.push({
      name: owner.name,
      color: owner.color || '#3b82f6',
      startDate: consultantStartDate,
      current: calculateMetrics(currentData, campaignIds.size),
      previous: previousData.length > 0 ? calculateMetrics(previousData, campaignIds.size) : null,
      timeline: Array.from(timelineMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, data]) => ({
          date,
          cost: Math.round(data.cost),
          purchase: data.purchase,
          cpa: data.purchase > 0 ? Math.round(data.cost / data.purchase) : 0,
          cr: data.clicks > 0 ? Math.round((data.purchase / data.clicks) * 10000) / 100 : 0,
        })),
      campaigns: Array.from(campaignsMap.entries())
        .map(([campaign_id, data]) => ({
          campaign_id,
          campaign: data.campaign,
          cost: Math.round(data.cost),
          purchase: data.purchase,
          cpa: data.purchase > 0 ? Math.round(data.cost / data.purchase) : 0,
          cr: data.clicks > 0 ? Math.round((data.purchase / data.clicks) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.cost - a.cost),
    });
  }

  // Filtra per consulente se richiesto
  const filteredData = consultantFilter
    ? consultantsData.filter(c => c.name === consultantFilter || c.name === 'Marais')
    : consultantsData;

  return NextResponse.json({
    consultants: filteredData,
    owners: [{ name: 'Marais', color: '#f97316' }, ...owners.map(o => ({ name: o.name, color: o.color || '#3b82f6' }))],
    period: {
      current: { from: currentStartStr, to: currentEnd },
      previous: { from: previousStartStr, to: previousEndStr },
    },
  });
}
