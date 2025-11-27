import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT DISTINCT campaign FROM campaign_daily ORDER BY campaign
  `).all() as { campaign: string }[];

  return NextResponse.json(rows.map(r => r.campaign));
}
