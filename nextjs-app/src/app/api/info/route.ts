import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const dates = db.prepare(`
    SELECT MIN(date) as min_date, MAX(date) as max_date FROM campaign_daily
  `).get() as { min_date: string; max_date: string };

  const campaigns = db.prepare(`
    SELECT COUNT(DISTINCT campaign) as campaigns FROM campaign_daily
  `).get() as { campaigns: number };

  const searchRows = db.prepare(`
    SELECT COUNT(*) as total FROM search_queries
  `).get() as { total: number };

  const displayRows = db.prepare(`
    SELECT COUNT(*) as total FROM display_data
  `).get() as { total: number };

  return NextResponse.json({
    min_date: dates.min_date,
    max_date: dates.max_date,
    campaigns_count: campaigns.campaigns,
    search_rows: searchRows.total,
    display_rows: displayRows.total,
  });
}
