import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDateFilter } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : null;
  const campaign = searchParams.get('campaign') || '';
  const criteriaType = searchParams.get('type') || '';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'cost';
  const sortDir = searchParams.get('sortDir') || 'desc';

  const db = getDb();
  const dateFrom = getDateFilter(days);

  // Colonne valide per ordinamento (whitelist per sicurezza)
  const validSortColumns = ['query', 'impressions', 'clicks', 'cost', 'purchase', 'addtocart', 'checkout', 'ctr', 'avg_impr_position'];
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'cost';
  const safeSortDir = sortDir === 'asc' ? 'ASC' : 'DESC';

  // Build WHERE clause
  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (dateFrom) {
    whereClause += ' AND date >= ?';
    params.push(dateFrom);
  }

  if (campaign) {
    whereClause += ' AND campaign = ?';
    params.push(campaign);
  }

  if (criteriaType) {
    whereClause += ' AND criteria_type = ?';
    params.push(criteriaType);
  }

  // 1. Query for TOTALS (always on all filtered data)
  const totalsSql = `
    SELECT
      criteria_type,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      SUM(purchase) as purchase,
      SUM(addtocart) as addtocart,
      SUM(checkout) as checkout,
      COUNT(DISTINCT campaign || '|' || query) as query_count
    FROM search_queries
    ${whereClause}
    GROUP BY criteria_type
  `;

  const totalsRows = db.prepare(totalsSql).all(...params) as Array<{
    criteria_type: string;
    impressions: number;
    clicks: number;
    cost: number;
    purchase: number;
    addtocart: number;
    checkout: number;
    query_count: number;
  }>;

  const totals = { clicks: 0, cost: 0, purchase: 0, addtocart: 0, checkout: 0, impressions: 0, queries_count: 0, cpa: 0, cr: 0 };
  const totalsByType: Record<string, { clicks: number; cost: number; purchase: number; addtocart: number; checkout: number; count: number }> = {
    KEYWORD: { clicks: 0, cost: 0, purchase: 0, addtocart: 0, checkout: 0, count: 0 },
    AUTOTARGETING: { clicks: 0, cost: 0, purchase: 0, addtocart: 0, checkout: 0, count: 0 },
    OTHER: { clicks: 0, cost: 0, purchase: 0, addtocart: 0, checkout: 0, count: 0 },
  };

  for (const row of totalsRows) {
    const key = row.criteria_type === 'KEYWORD' ? 'KEYWORD' : row.criteria_type === 'AUTOTARGETING' ? 'AUTOTARGETING' : 'OTHER';

    totals.clicks += row.clicks || 0;
    totals.cost += row.cost || 0;
    totals.purchase += row.purchase || 0;
    totals.addtocart += row.addtocart || 0;
    totals.checkout += row.checkout || 0;
    totals.impressions += row.impressions || 0;
    totals.queries_count += row.query_count || 0;

    totalsByType[key].clicks += row.clicks || 0;
    totalsByType[key].cost += row.cost || 0;
    totalsByType[key].purchase += row.purchase || 0;
    totalsByType[key].addtocart += row.addtocart || 0;
    totalsByType[key].checkout += row.checkout || 0;
    totalsByType[key].count += row.query_count || 0;
  }

  // 2. Query for ROWS with pagination
  let queriesSql = `
    SELECT
      query, campaign, criterion, criteria_type,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(cost) as cost,
      SUM(purchase) as purchase,
      SUM(addtocart) as addtocart,
      SUM(checkout) as checkout,
      AVG(CASE WHEN avg_cpc > 0 THEN avg_cpc END) as avg_cpc,
      AVG(CASE WHEN avg_click_position > 0 THEN avg_click_position END) as avg_position,
      AVG(CASE WHEN avg_impr_position > 0 THEN avg_impr_position END) as avg_impr_position,
      AVG(CASE WHEN ctr > 0 THEN ctr END) as ctr
    FROM search_queries
    ${whereClause}
  `;
  const queryParams = [...params];

  if (search) {
    queriesSql += ' AND (query LIKE ? OR criterion LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  queriesSql += ` GROUP BY campaign, query ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`;
  queryParams.push(limit, offset);

  const rows = db.prepare(queriesSql).all(...queryParams) as Array<{
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
  }>;

  const queries = rows.map(row => {
    const clicks = row.clicks || 0;
    const cost = row.cost || 0;
    const purchase = row.purchase || 0;
    const cpa = purchase > 0 ? cost / purchase : 0;
    const cr = clicks > 0 ? (purchase / clicks) * 100 : 0;

    return {
      query: row.query,
      campaign: row.campaign,
      criterion: row.criterion,
      criteria_type: row.criteria_type,
      impressions: row.impressions || 0,
      clicks,
      cost: Math.round(cost * 100) / 100,
      purchase,
      addtocart: row.addtocart || 0,
      checkout: row.checkout || 0,
      avg_cpc: Math.round((row.avg_cpc || 0) * 100) / 100,
      avg_position: Math.round((row.avg_position || 0) * 100) / 100,
      avg_impr_position: Math.round((row.avg_impr_position || 0) * 100) / 100,
      ctr: Math.round((row.ctr || 0) * 100) / 100,
      cpa: Math.round(cpa * 100) / 100,
      cr: Math.round(cr * 100) / 100,
    };
  });

  // Get campaigns list
  const campaigns = db.prepare(`
    SELECT DISTINCT campaign FROM search_queries ORDER BY campaign
  `).all() as { campaign: string }[];

  // Calculate totals CPA and CR
  totals.cost = Math.round(totals.cost * 100) / 100;
  totals.cpa = totals.purchase > 0 ? Math.round((totals.cost / totals.purchase) * 100) / 100 : 0;
  totals.cr = totals.clicks > 0 ? Math.round((totals.purchase / totals.clicks) * 10000) / 100 : 0;

  for (const t of Object.values(totalsByType)) {
    t.cost = Math.round(t.cost * 100) / 100;
  }

  return NextResponse.json({
    queries,
    totals,
    totals_by_type: totalsByType,
    campaigns: campaigns.map(c => c.campaign),
    pagination: {
      limit,
      offset,
      total: totals.queries_count,
      has_more: offset + queries.length < totals.queries_count,
    },
  });
}
