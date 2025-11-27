import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDateFilter } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;
  const campaign = searchParams.get('campaign') || '';
  const view = searchParams.get('view') || 'adgroups';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'cost';
  const sortDir = searchParams.get('sortDir') || 'desc';

  const db = getDb();

  // Colonne valide per ordinamento (whitelist per sicurezza)
  const validSortColumns = ['impressions', 'clicks', 'cost', 'purchase', 'addtocart', 'checkout', 'campaign', 'adgroup', 'placement', 'criteria'];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'cost';
  const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';
  const dateFrom = getDateFilter(days);

  let sql: string;
  let groupBy: string;

  if (view === 'adgroups') {
    sql = `
      SELECT
        campaign, adgroup,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost) as cost,
        SUM(purchase) as purchase,
        SUM(addtocart) as addtocart,
        SUM(checkout) as checkout
      FROM display_data
      WHERE 1=1
    `;
    groupBy = 'GROUP BY campaign, adgroup';
  } else if (view === 'placements') {
    sql = `
      SELECT
        placement,
        GROUP_CONCAT(DISTINCT campaign) as campaigns_str,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost) as cost,
        SUM(purchase) as purchase,
        SUM(addtocart) as addtocart,
        SUM(checkout) as checkout
      FROM display_data
      WHERE 1=1
    `;
    groupBy = 'GROUP BY placement';
  } else {
    sql = `
      SELECT
        criteria, criteria_type,
        GROUP_CONCAT(DISTINCT campaign) as campaigns_str,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost) as cost,
        SUM(purchase) as purchase,
        SUM(addtocart) as addtocart,
        SUM(checkout) as checkout
      FROM display_data
      WHERE 1=1
    `;
    groupBy = 'GROUP BY criteria_type, criteria';
  }

  const params: (string | number)[] = [];

  if (dateFrom) {
    sql += ' AND date >= ?';
    params.push(dateFrom);
  }

  if (campaign) {
    sql += ' AND campaign = ?';
    params.push(campaign);
  }

  // Aggiungi filtro ricerca
  if (search) {
    if (view === 'adgroups') {
      sql += ' AND (adgroup LIKE ? OR campaign LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    } else if (view === 'placements') {
      sql += ' AND placement LIKE ?';
      params.push(`%${search}%`);
    } else {
      sql += ' AND criteria LIKE ?';
      params.push(`%${search}%`);
    }
  }

  // Prima query: conta totali per paginazione (senza LIMIT)
  const countSql = `SELECT COUNT(*) as total FROM (${sql} ${groupBy})`;
  const countResult = db.prepare(countSql).get(...params) as { total: number };
  const totalItems = countResult.total;

  // Query totali aggregati (per le metriche in cima)
  const totalsSql = `
    SELECT
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      SUM(purchase) as purchase,
      SUM(addtocart) as addtocart,
      SUM(checkout) as checkout
    FROM display_data
    WHERE 1=1
    ${dateFrom ? 'AND date >= ?' : ''}
    ${campaign ? 'AND campaign = ?' : ''}
  `;
  const totalsParams: (string | number)[] = [];
  if (dateFrom) totalsParams.push(dateFrom);
  if (campaign) totalsParams.push(campaign);

  const totalsRow = db.prepare(totalsSql).get(...totalsParams) as {
    impressions: number;
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
  };

  // Query principale con paginazione e ordinamento
  sql += ` ${groupBy} ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params) as Array<{
    campaign?: string;
    adgroup?: string;
    placement?: string;
    criteria?: string;
    criteria_type?: string;
    campaigns_str?: string;
    impressions: number;
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
  }>;

  const items = [];

  for (const row of rows) {
    const clicks = row.clicks || 0;
    const cost = row.cost || 0;
    const purchase = row.purchase || 0;
    const addtocart = row.addtocart || 0;
    const checkout = row.checkout || 0;
    const impressions = row.impressions || 0;

    const cpa = purchase > 0 ? cost / purchase : 0;
    const cr = clicks > 0 ? (purchase / clicks) * 100 : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const item: Record<string, unknown> = {
      impressions,
      clicks,
      cost: Math.round(cost * 100) / 100,
      purchase,
      addtocart,
      checkout,
      cpa: Math.round(cpa * 100) / 100,
      cr: Math.round(cr * 100) / 100,
      ctr: Math.round(ctr * 100) / 100,
    };

    if (view === 'adgroups') {
      item.campaign = row.campaign;
      item.adgroup = row.adgroup;
    } else if (view === 'placements') {
      item.placement = row.placement;
      item.campaigns = row.campaigns_str ? row.campaigns_str.split(',') : [];
    } else {
      item.criteria = row.criteria;
      item.criteria_type = row.criteria_type;
      item.campaigns = row.campaigns_str ? row.campaigns_str.split(',') : [];
    }

    items.push(item);
  }

  // Get campaigns list
  const campaigns = db.prepare(`
    SELECT DISTINCT campaign FROM display_data ORDER BY campaign
  `).all() as { campaign: string }[];

  // Calcola totali globali da totalsRow (tutti i dati, non solo pagina corrente)
  const totalCost = totalsRow.cost || 0;
  const totalClicks = totalsRow.clicks || 0;
  const totalPurchase = totalsRow.purchase || 0;

  const totals = {
    impressions: totalsRow.impressions || 0,
    clicks: totalClicks,
    cost: Math.round(totalCost * 100) / 100,
    purchase: totalPurchase,
    addtocart: totalsRow.addtocart || 0,
    checkout: totalsRow.checkout || 0,
    cpa: totalPurchase > 0 ? Math.round((totalCost / totalPurchase) * 100) / 100 : 0,
    cr: totalClicks > 0 ? Math.round((totalPurchase / totalClicks) * 10000) / 100 : 0,
    [`${view}_count`]: totalItems,
  };

  return NextResponse.json({
    [view]: items,
    totals,
    campaigns: campaigns.map(c => c.campaign),
    pagination: {
      limit,
      offset,
      total: totalItems,
      has_more: offset + items.length < totalItems,
    },
  });
}
