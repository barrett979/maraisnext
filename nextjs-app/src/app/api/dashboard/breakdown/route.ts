import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface PeriodData {
  campaign_id: string;
  campaign: string;
  clicks: number;
  cost: number;
  purchase: number;
  addtocart: number;
  checkout: number;
  impressions: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;

  const db = getDb();

  // Calcola date per periodo corrente e precedente
  const now = new Date();
  const daysNum = days || 30;

  const currentEnd = now.toISOString().split('T')[0];
  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - daysNum);
  const currentStartStr = currentStart.toISOString().split('T')[0];

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - daysNum + 1);
  const previousEndStr = previousEnd.toISOString().split('T')[0];
  const previousStartStr = previousStart.toISOString().split('T')[0];

  // Query per periodo corrente - per campagna (includi campaign_id e ultimo nome)
  const currentCampaignsSql = `
    SELECT
      campaign_id,
      MAX(campaign) as campaign,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      SUM(purchase) as purchase,
      SUM(addtocart) as addtocart,
      SUM(checkout) as checkout
    FROM campaign_daily
    WHERE date >= ? AND date <= ?
    GROUP BY campaign_id
    ORDER BY cost DESC
  `;
  const currentCampaigns = db.prepare(currentCampaignsSql).all(currentStartStr, currentEnd) as PeriodData[];

  // Query per periodo precedente - per campagna
  const previousCampaignsSql = `
    SELECT
      campaign_id,
      MAX(campaign) as campaign,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      SUM(purchase) as purchase,
      SUM(addtocart) as addtocart,
      SUM(checkout) as checkout
    FROM campaign_daily
    WHERE date >= ? AND date <= ?
    GROUP BY campaign_id
  `;
  const previousCampaigns = db.prepare(previousCampaignsSql).all(previousStartStr, previousEndStr) as PeriodData[];

  // Crea mappa periodo precedente per lookup veloce (usa campaign_id)
  const prevMap = new Map<string, PeriodData>();
  for (const row of previousCampaigns) {
    prevMap.set(row.campaign_id, row);
  }

  // Costruisci breakdown per campagna con variazioni (solo campagne con spesa > 0)
  const campaignsWithSpend = currentCampaigns.filter(c => c.cost > 0);
  const campaignBreakdown = campaignsWithSpend.map(curr => {
    const prev = prevMap.get(curr.campaign_id);
    const currCpa = curr.purchase > 0 ? curr.cost / curr.purchase : 0;
    const prevCpa = prev && prev.purchase > 0 ? prev.cost / prev.purchase : 0;
    const currCr = curr.clicks > 0 ? (curr.purchase / curr.clicks) * 100 : 0;
    const prevCr = prev && prev.clicks > 0 ? (prev.purchase / prev.clicks) * 100 : 0;

    return {
      campaign_id: curr.campaign_id,
      campaign: curr.campaign,
      current: {
        clicks: curr.clicks,
        cost: Math.round(curr.cost),
        purchase: curr.purchase,
        addtocart: curr.addtocart || 0,
        checkout: curr.checkout || 0,
        cpa: Math.round(currCpa),
        cr: Math.round(currCr * 100) / 100,
      },
      previous: prev ? {
        clicks: prev.clicks,
        cost: Math.round(prev.cost),
        purchase: prev.purchase,
        addtocart: prev.addtocart || 0,
        checkout: prev.checkout || 0,
        cpa: Math.round(prevCpa),
        cr: Math.round(prevCr * 100) / 100,
      } : null,
      changes: prev ? {
        cost: prev.cost > 0 ? Math.round(((curr.cost - prev.cost) / prev.cost) * 1000) / 10 : null,
        purchase: prev.purchase > 0 ? Math.round(((curr.purchase - prev.purchase) / prev.purchase) * 1000) / 10 : (curr.purchase > 0 ? 100 : null),
        addtocart: prev.addtocart > 0 ? Math.round((((curr.addtocart || 0) - prev.addtocart) / prev.addtocart) * 1000) / 10 : null,
        checkout: prev.checkout > 0 ? Math.round((((curr.checkout || 0) - prev.checkout) / prev.checkout) * 1000) / 10 : null,
        cpa: prevCpa > 0 ? Math.round(((currCpa - prevCpa) / prevCpa) * 1000) / 10 : null,
        cr: prevCr > 0 ? Math.round(((currCr - prevCr) / prevCr) * 1000) / 10 : null,
      } : null,
    };
  });

  return NextResponse.json({
    campaignBreakdown,
    period: {
      current: { from: currentStartStr, to: currentEnd },
      previous: { from: previousStartStr, to: previousEndStr },
    },
  });
}
